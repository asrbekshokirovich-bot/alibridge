from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import (
    CustodyEventType,
    HolderType,
    ProductStatus,
)
from app.core.errors import AppError
from app.db.models import CustodyEvent, CustodyHolding, Product, ProductVariant

# Yuk yo'li bosqichlari tartibi (rank) — eng orqada qolgan miqdor statusni belgilaydi.
HOLDER_RANK: dict[HolderType, int] = {
    HolderType.WAREHOUSE_UZ: 0,
    HolderType.COURIER_UZ: 1,
    HolderType.CARRIER: 2,
    HolderType.COURIER_TR: 3,
    HolderType.WAREHOUSE_TR: 4,
    HolderType.ORDERER: 5,
}

# Bosqich nomlari (hisobot/taqsimotda ko'rsatish uchun)
STAGE_LABELS: dict[HolderType, str] = {
    HolderType.WAREHOUSE_UZ: "Toshkent omborida",
    HolderType.COURIER_UZ: "Toshkent kuryerida",
    HolderType.CARRIER: "Yo'lovchida",
    HolderType.COURIER_TR: "Turkiya kuryerida",
    HolderType.WAREHOUSE_TR: "Turkiya omborida",
    HolderType.ORDERER: "Buyurtmachida",
}

# rank -> Product.status (eng orqada qolgan bosqichga mos)
_RANK_TO_STATUS: dict[int, ProductStatus] = {
    0: ProductStatus.IN_WAREHOUSE_UZ,
    1: ProductStatus.WITH_COURIER_UZ,
    2: ProductStatus.WITH_CARRIER,
    3: ProductStatus.DELIVERED_TR,
    4: ProductStatus.DELIVERED_TR,
    5: ProductStatus.DELIVERED_TR,
}

# TR omborga "yetib bordi" hisoblanadigan bosqichlar (rank >= 4)
_ARRIVED_RANK = HOLDER_RANK[HolderType.WAREHOUSE_TR]


async def get_product_by_barcode(db: AsyncSession, barcode: str) -> Product:
    product = await db.scalar(select(Product).where(Product.barcode == barcode))
    if product is None:
        raise AppError("BARCODE_NOT_FOUND", "Barkod topilmadi", status_code=400)
    return product


async def get_holdings_for_product(db: AsyncSession, product_id: int) -> list[CustodyHolding]:
    rows = await db.execute(select(CustodyHolding).where(CustodyHolding.product_id == product_id))
    return list(rows.scalars().all())


async def get_holding(
    db: AsyncSession,
    *,
    variant_id: int,
    holder_type: HolderType,
    holder_id: int,
    for_update: bool = False,
) -> CustodyHolding | None:
    stmt = select(CustodyHolding).where(
        CustodyHolding.variant_id == variant_id,
        CustodyHolding.holder_type == holder_type,
        CustodyHolding.holder_id == holder_id,
    )
    if for_update:
        stmt = stmt.with_for_update()
    return await db.scalar(stmt)


async def available_qty(
    db: AsyncSession,
    *,
    variant_id: int,
    holder_type: HolderType,
    holder_id: int,
) -> int:
    """Shu egada shu variantdan nechta bor (yo'q bo'lsa 0)."""
    h = await get_holding(db, variant_id=variant_id, holder_type=holder_type, holder_id=holder_id)
    return h.quantity if h else 0


async def availability_for_holder(
    db: AsyncSession,
    *,
    product: Product,
    holder_type: HolderType,
    holder_id: int,
) -> list[tuple[int, str, int]]:
    """Manba egada har o'lchamdan nechta bor: [(variant_id, size_label, available)].
    Faqat miqdori > 0 bo'lgan variantlar qaytadi."""
    holdings = await db.execute(
        select(CustodyHolding).where(
            CustodyHolding.product_id == product.id,
            CustodyHolding.holder_type == holder_type,
            CustodyHolding.holder_id == holder_id,
            CustodyHolding.quantity > 0,
        )
    )
    by_variant = {h.variant_id: h.quantity for h in holdings.scalars().all()}
    result: list[tuple[int, str, int]] = []
    for v in product.variants:
        qty = by_variant.get(v.id, 0)
        if qty > 0:
            result.append((v.id, v.size_label, qty))
    return result


async def find_source_holder_id(
    db: AsyncSession, *, variant_id: int, holder_type: HolderType
) -> int | None:
    """Shu variant shu turdagi qaysi egada (holder_id) turibdi — eng ko'p
    miqdorli birinchisi. TR ombor/kuryer qabul qilganda manba yo'lovchini topish
    uchun (qaysi yo'lovchida turgani scan'da noma'lum)."""
    h = await db.scalar(
        select(CustodyHolding)
        .where(
            CustodyHolding.variant_id == variant_id,
            CustodyHolding.holder_type == holder_type,
            CustodyHolding.quantity > 0,
        )
        .order_by(CustodyHolding.quantity.desc())
    )
    return h.holder_id if h else None


async def availability_by_type(
    db: AsyncSession, *, product: Product, holder_type: HolderType
) -> list[tuple[int, str, int]]:
    """Shu turdagi (holder_id farqsiz) barcha egalarda har o'lchamdan jami nechta.
    TR qabul oqimlari uchun: yuk qaysi yo'lovchida ekani muhim emas, jami muhim."""
    holdings = await db.execute(
        select(CustodyHolding).where(
            CustodyHolding.product_id == product.id,
            CustodyHolding.holder_type == holder_type,
            CustodyHolding.quantity > 0,
        )
    )
    by_variant: dict[int, int] = {}
    for h in holdings.scalars().all():
        by_variant[h.variant_id] = by_variant.get(h.variant_id, 0) + h.quantity
    result: list[tuple[int, str, int]] = []
    for v in product.variants:
        qty = by_variant.get(v.id, 0)
        if qty > 0:
            result.append((v.id, v.size_label, qty))
    return result


async def resolve_variant_id(db: AsyncSession, *, product: Product, variant_id: int | None) -> int:
    """variant_id berilmasa: product yagona variantli bo'lsa o'shani, aks holda xato."""
    if variant_id is not None:
        if not any(v.id == variant_id for v in product.variants):
            raise AppError("VARIANT_NOT_FOUND", "O'lcham topilmadi", status_code=400)
        return variant_id
    if len(product.variants) == 1:
        return product.variants[0].id
    raise AppError("VARIANT_REQUIRED", "O'lchamni tanlang", status_code=400)


async def sync_warehouse_holding(db: AsyncSession, variant: ProductVariant) -> None:
    """Ombor qabuli / variant miqdori o'zgarganda WAREHOUSE_UZ holding'ni
    variant.quantity ga tenglashtiradi. Faqat yuk hali jo'natilmagan
    (boshqa egada holding yo'q) bo'lsa ishlatiladi — aks holda split buziladi.
    """
    others = await db.execute(
        select(CustodyHolding).where(
            CustodyHolding.variant_id == variant.id,
            CustodyHolding.holder_type != HolderType.WAREHOUSE_UZ,
        )
    )
    if others.scalars().first() is not None:
        # Yuk allaqachon harakatlangan — avtomatik sinxron qilmaymiz.
        return

    h = await get_holding(
        db,
        variant_id=variant.id,
        holder_type=HolderType.WAREHOUSE_UZ,
        holder_id=0,
        for_update=True,
    )
    if variant.quantity <= 0:
        if h is not None:
            await db.delete(h)
        return
    if h is None:
        db.add(
            CustodyHolding(
                product_id=variant.product_id,
                variant_id=variant.id,
                holder_type=HolderType.WAREHOUSE_UZ,
                holder_id=0,
                quantity=variant.quantity,
            )
        )
    else:
        h.quantity = variant.quantity
    await db.flush()


async def _recompute_product_status(db: AsyncSession, product: Product) -> None:
    """Status = eng orqada qolgan (min-rank) holding bosqichiga mos.
    Holding bo'lmasa status o'zgarmaydi (yangi/bo'sh mahsulot)."""
    holdings = await get_holdings_for_product(db, product.id)
    ranks = [
        HOLDER_RANK[h.holder_type]
        for h in holdings
        if h.quantity > 0 and h.holder_type in HOLDER_RANK
    ]
    if not ranks:
        return
    if product.status == ProductStatus.DAMAGED:
        return  # zarar holatini bekor qilmaymiz
    product.status = _RANK_TO_STATUS[min(ranks)]


async def is_fully_arrived(db: AsyncSession, product_id: int) -> bool:
    """Bir mahsulotning barcha miqdori TR omborga (yoki keyingi bosqichga)
    yetganmi — ya'ni rank < WAREHOUSE_TR bo'lgan miqdor qolmaganmi."""
    holdings = await get_holdings_for_product(db, product_id)
    total = sum(h.quantity for h in holdings if h.quantity > 0)
    if total == 0:
        return False
    behind = sum(
        h.quantity
        for h in holdings
        if h.quantity > 0 and HOLDER_RANK.get(h.holder_type, 0) < _ARRIVED_RANK
    )
    return behind == 0


async def transfer_custody(
    db: AsyncSession,
    product: Product,
    *,
    variant_id: int,
    quantity: int,
    from_holder_type: HolderType,
    from_holder_id: int,
    to_holder_type: HolderType,
    to_holder_id: int,
    event_type: CustodyEventType,
    scanned_by: int | None,
) -> CustodyEvent:
    """Yuk egaligini MIQDOR bo'yicha ko'chiradi (split custody).

    Manbadan ayiradi, maqsadga qo'shadi, custody_events ga yozadi (APPEND ONLY).
    Manba holding FOR UPDATE bilan qulflanadi — parallel skan race-condition'siz.
    """
    if quantity <= 0:
        raise AppError("INVALID_QUANTITY", "Miqdor noto'g'ri", status_code=400)

    # 1) Manba holding — qulflab o'qish
    src = await get_holding(
        db,
        variant_id=variant_id,
        holder_type=from_holder_type,
        holder_id=from_holder_id,
        for_update=True,
    )
    if src is None or src.quantity < quantity:
        have = src.quantity if src else 0
        raise AppError(
            "INSUFFICIENT_QUANTITY",
            f"Yetarli miqdor yo'q (bor: {have}, so'ralgan: {quantity})",
            status_code=400,
        )

    # 2) Manbadan ayirish (0 bo'lsa satrni o'chirish)
    src.quantity -= quantity
    if src.quantity == 0:
        await db.delete(src)

    # 3) Maqsadga qo'shish
    dst = await get_holding(
        db,
        variant_id=variant_id,
        holder_type=to_holder_type,
        holder_id=to_holder_id,
        for_update=True,
    )
    if dst is None:
        db.add(
            CustodyHolding(
                product_id=product.id,
                variant_id=variant_id,
                holder_type=to_holder_type,
                holder_id=to_holder_id,
                quantity=quantity,
            )
        )
    else:
        dst.quantity += quantity

    # 4) Tarix (APPEND ONLY)
    event = CustodyEvent(
        product_id=product.id,
        variant_id=variant_id,
        quantity=quantity,
        from_holder_type=from_holder_type,
        from_holder_id=from_holder_id or None,
        to_holder_type=to_holder_type,
        to_holder_id=to_holder_id or None,
        event_type=event_type,
        scanned_by=scanned_by,
    )
    db.add(event)

    # 5) Denormalizatsiya (oxirgi tegilgan ega — ko'rsatuv) + status
    product.custody_holder_type = to_holder_type
    product.custody_holder_id = to_holder_id or None

    await db.flush()
    await _recompute_product_status(db, product)
    await db.flush()
    return event


async def drain_from_type(
    db: AsyncSession,
    product: Product,
    *,
    variant_id: int,
    quantity: int,
    from_holder_type: HolderType,
    to_holder_type: HolderType,
    to_holder_id: int,
    event_type: CustodyEventType,
    scanned_by: int | None,
) -> int:
    """So'ralgan miqdorni shu TURDAGI (holder_id farqsiz) barcha egalardan
    KETMA-KET ayiradi (split custody — yuk bir nechta egaga bo'lingan bo'lishi mumkin).

    TR qabul oqimlari uchun: bir barkod+o'lcham bir nechta yo'lovchi/kuryerda
    turgan bo'lsa, jami yetarli bo'lsa hammasidan yig'ib ko'chiradi.
    Qaytaradi: aslida ko'chirilgan miqdor (yetarli bo'lmasa AppError).
    """
    if quantity <= 0:
        raise AppError("INVALID_QUANTITY", "Miqdor noto'g'ri", status_code=400)

    holdings = await db.execute(
        select(CustodyHolding)
        .where(
            CustodyHolding.variant_id == variant_id,
            CustodyHolding.holder_type == from_holder_type,
            CustodyHolding.quantity > 0,
        )
        .order_by(CustodyHolding.quantity.desc())
    )
    sources = list(holdings.scalars().all())
    total_available = sum(h.quantity for h in sources)
    if total_available < quantity:
        raise AppError(
            "INSUFFICIENT_QUANTITY",
            f"Yetarli miqdor yo'q (bor: {total_available}, so'ralgan: {quantity})",
            status_code=400,
        )

    remaining = quantity
    for h in sources:
        if remaining <= 0:
            break
        take = min(h.quantity, remaining)
        await transfer_custody(
            db,
            product,
            variant_id=variant_id,
            quantity=take,
            from_holder_type=from_holder_type,
            from_holder_id=h.holder_id,
            to_holder_type=to_holder_type,
            to_holder_id=to_holder_id,
            event_type=event_type,
            scanned_by=scanned_by,
        )
        remaining -= take
    return quantity
