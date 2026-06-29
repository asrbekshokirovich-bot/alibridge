from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import require_role
from app.api.v1.endpoints.warehouse_uz import build_daily_out
from app.bot import notify
from app.core.enums import (
    CustodyEventType,
    HolderType,
    ProductStatus,
    Role,
)
from app.core.errors import AppError
from app.db.base import get_db
from app.db.models import (
    CustodyHolding,
    Order,
    OrderItem,
    Product,
    ProductVariant,
    User,
    WalkInCustomer,
)
from app.schemas.common import OkResponse
from app.schemas.product import ProductOut
from app.schemas.serializers import product_to_out
from app.schemas.warehouse import (
    ConfirmRequest,
    DailyOutReport,
    HeldCargoItem,
    ReceiveGroup,
    ReceiveGroupItem,
    ScanRequest,
    ScanResponse,
    VariantAvailability,
    WalkInRequest,
)
from app.services.custody_service import (
    STAGE_LABELS,
    availability_by_type,
    drain_from_type,
    is_fully_arrived,
    resolve_variant_id,
    transfer_custody,
)
from app.services.order_service import advance_orders_delivered_for_carrier
from app.services.payment_service import recompute_carrier_payment

router = APIRouter(prefix="/warehouse-tr", tags=["warehouse_tr"])

ROLE = (Role.WAREHOUSE_TR,)


async def _carrier_for_product(db: AsyncSession, product_id: int) -> User | None:
    return await db.scalar(
        select(User)
        .join(Order, Order.carrier_id == User.id)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(OrderItem.product_id == product_id)
        .limit(1)
    )


# ─── Yo'lovchidan qabul ─────────────────────────────────────────────────────────


@router.get("/receive-groups", response_model=list[ReceiveGroup])
async def receive_groups(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> list[ReceiveGroup]:
    """Hozir yo'lovchilarda (CARRIER) turgan, TR ombor qabul qiladigan yuklar —
    yo'lovchi bo'yicha guruhlangan. Har bir yuk skanlab tekshiriladi."""
    rows = await db.execute(
        select(CustodyHolding, Product, ProductVariant, User)
        .join(Product, Product.id == CustodyHolding.product_id)
        .join(ProductVariant, ProductVariant.id == CustodyHolding.variant_id)
        .outerjoin(User, User.id == CustodyHolding.holder_id)
        .where(
            CustodyHolding.holder_type == HolderType.CARRIER,
            CustodyHolding.quantity > 0,
        )
        .order_by(CustodyHolding.holder_id, Product.created_at.desc())
    )
    groups: dict[int, ReceiveGroup] = {}
    for h, p, v, u in rows.all():
        g = groups.get(h.holder_id)
        if g is None:
            g = ReceiveGroup(
                holder_id=h.holder_id,
                holder_name=f"{u.first_name} {u.last_name}".strip() if u else "",
                holder_number=u.carrier_number if u else None,
                items=[],
                total=0,
            )
            groups[h.holder_id] = g
        g.items.append(
            ReceiveGroupItem(
                product_id=p.id,
                variant_id=v.id,
                barcode=p.barcode,
                product_name=p.name,
                size_label=v.size_label,
                quantity=h.quantity,
            )
        )
        g.total += h.quantity
    return list(groups.values())


@router.post("/scan-receive", response_model=ScanResponse)
async def scan_receive(
    body: ScanRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> ScanResponse:
    product = await db.scalar(
        select(Product)
        .options(selectinload(Product.variants))
        .where(Product.barcode == body.barcode)
    )
    if product is None:
        raise AppError("BARCODE_NOT_FOUND", "Barkod topilmadi", status_code=400)
    carrier = await _carrier_for_product(db, product.id)
    # Yo'lovchi(lar)da (CARRIER) shu yukdan nechta bor — TR ombor qabul qiladi
    avail = await availability_by_type(db, product=product, holder_type=HolderType.CARRIER)
    if not avail:
        raise AppError(
            "INVALID_PRODUCT_STATE",
            "Bu yukdan yo'lovchida qolmagan yoki allaqachon qabul qilingan",
        )
    return ScanResponse(
        barcode=product.barcode,
        product_name=product.name,
        carrier_name=f"{carrier.first_name} {carrier.last_name}".strip() if carrier else None,
        quantity=sum(a[2] for a in avail),
        available_by_variant=[
            VariantAvailability(variant_id=vid, size_label=sl, available=q) for vid, sl, q in avail
        ],
    )


@router.post("/confirm-receive", response_model=OkResponse)
async def confirm_receive(
    body: ConfirmRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> OkResponse:
    affected_carriers: set[int] = set()
    for item in body.items:
        product = await db.scalar(
            select(Product)
            .options(selectinload(Product.variants))
            .where(Product.barcode == item.barcode)
        )
        if product is None:
            raise AppError("BARCODE_NOT_FOUND", f"Barkod topilmadi: {item.barcode}")
        variant_id = await resolve_variant_id(db, product=product, variant_id=item.variant_id)
        # Yuk bir nechta yo'lovchiga bo'lingan bo'lishi mumkin — hammasidan yig'ib olamiz
        await drain_from_type(
            db,
            product,
            variant_id=variant_id,
            quantity=item.quantity,
            from_holder_type=HolderType.CARRIER,
            to_holder_type=HolderType.WAREHOUSE_TR,
            to_holder_id=0,
            event_type=CustodyEventType.WAREHOUSE_TR_RECEIVED,
            scanned_by=user.id,
        )
        carrier = await _carrier_for_product(db, product.id)
        if carrier:
            affected_carriers.add(carrier.id)
        # Bu mahsulotning hammasi TR omborga yetdimi?
        if await is_fully_arrived(db, product.id):
            await notify.on_all_arrived(
                db,
                barcode=product.barcode,
                product_name=product.name,
                carrier_id=carrier.id if carrier else None,
            )

    # Yo'lovchi to'g'ridan TR omborga topshirgan bo'lsa ham to'lov hisoblanadi
    for carrier_id in affected_carriers:
        await recompute_carrier_payment(db, carrier_id)
        # Yo'lovchi yukni topshirdi — buyurtma "Yetkazildi" (DELIVERED_TR) ga
        await advance_orders_delivered_for_carrier(db, carrier_id)
    return OkResponse(ok=True)


# ─── Kuryerga topshirish ────────────────────────────────────────────────────────


@router.post("/scan-handover", response_model=ScanResponse)
async def scan_handover(
    body: ScanRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> ScanResponse:
    product = await db.scalar(
        select(Product)
        .options(selectinload(Product.variants))
        .where(Product.barcode == body.barcode)
    )
    if product is None:
        raise AppError("BARCODE_NOT_FOUND", "Barkod topilmadi", status_code=400)
    avail = await availability_by_type(db, product=product, holder_type=HolderType.WAREHOUSE_TR)
    if not avail:
        raise AppError("INVALID_PRODUCT_STATE", "Bu yukdan omborda qolmagan")
    return ScanResponse(
        barcode=product.barcode,
        product_name=product.name,
        quantity=sum(a[2] for a in avail),
        available_by_variant=[
            VariantAvailability(variant_id=vid, size_label=sl, available=q) for vid, sl, q in avail
        ],
    )


@router.post("/confirm-handover", response_model=OkResponse)
async def confirm_handover(
    body: ConfirmRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> OkResponse:
    for item in body.items:
        product = await db.scalar(
            select(Product)
            .options(selectinload(Product.variants))
            .where(Product.barcode == item.barcode)
        )
        if product is None:
            raise AppError("BARCODE_NOT_FOUND", f"Barkod topilmadi: {item.barcode}")
        variant_id = await resolve_variant_id(db, product=product, variant_id=item.variant_id)
        await transfer_custody(
            db,
            product,
            variant_id=variant_id,
            quantity=item.quantity,
            from_holder_type=HolderType.WAREHOUSE_TR,
            from_holder_id=0,
            to_holder_type=HolderType.COURIER_TR,
            to_holder_id=0,
            event_type=CustodyEventType.WAREHOUSE_TR_HANDOVER,
            scanned_by=user.id,
        )
    return OkResponse(ok=True)


# ─── Kuryerdan qabul (TR kuryeri qaytargan yukni ombor oladi) ───────────────────


@router.get("/receive-courier-groups", response_model=list[ReceiveGroup])
async def receive_courier_groups(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> list[ReceiveGroup]:
    """Hozir TR kuryerlarida (COURIER_TR) turgan yuklar — kuryer bo'yicha guruhlangan.
    TR ombor har bir yukni skanlab qabul qiladi."""
    rows = await db.execute(
        select(CustodyHolding, Product, ProductVariant, User)
        .join(Product, Product.id == CustodyHolding.product_id)
        .join(ProductVariant, ProductVariant.id == CustodyHolding.variant_id)
        .outerjoin(User, User.id == CustodyHolding.holder_id)
        .where(
            CustodyHolding.holder_type == HolderType.COURIER_TR,
            CustodyHolding.quantity > 0,
        )
        .order_by(CustodyHolding.holder_id, Product.created_at.desc())
    )
    groups: dict[int, ReceiveGroup] = {}
    for h, p, v, u in rows.all():
        g = groups.get(h.holder_id)
        if g is None:
            g = ReceiveGroup(
                holder_id=h.holder_id,
                holder_name=f"{u.first_name} {u.last_name}".strip() if u else "",
                holder_number=None,
                items=[],
                total=0,
            )
            groups[h.holder_id] = g
        g.items.append(
            ReceiveGroupItem(
                product_id=p.id,
                variant_id=v.id,
                barcode=p.barcode,
                product_name=p.name,
                size_label=v.size_label,
                quantity=h.quantity,
            )
        )
        g.total += h.quantity
    return list(groups.values())


@router.post("/scan-receive-courier", response_model=ScanResponse)
async def scan_receive_courier(
    body: ScanRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> ScanResponse:
    product = await db.scalar(
        select(Product)
        .options(selectinload(Product.variants))
        .where(Product.barcode == body.barcode)
    )
    if product is None:
        raise AppError("BARCODE_NOT_FOUND", "Barkod topilmadi", status_code=400)
    # TR kuryerida (COURIER_TR) shu yukdan nechta bor — ombor qabul qiladi
    avail = await availability_by_type(db, product=product, holder_type=HolderType.COURIER_TR)
    if not avail:
        raise AppError(
            "INVALID_PRODUCT_STATE",
            "Bu yukdan kuryerda qolmagan yoki allaqachon qabul qilingan",
        )
    return ScanResponse(
        barcode=product.barcode,
        product_name=product.name,
        quantity=sum(a[2] for a in avail),
        available_by_variant=[
            VariantAvailability(variant_id=vid, size_label=sl, available=q) for vid, sl, q in avail
        ],
    )


@router.post("/confirm-receive-courier", response_model=OkResponse)
async def confirm_receive_courier(
    body: ConfirmRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> OkResponse:
    for item in body.items:
        product = await db.scalar(
            select(Product)
            .options(selectinload(Product.variants))
            .where(Product.barcode == item.barcode)
        )
        if product is None:
            raise AppError("BARCODE_NOT_FOUND", f"Barkod topilmadi: {item.barcode}")
        variant_id = await resolve_variant_id(db, product=product, variant_id=item.variant_id)
        await drain_from_type(
            db,
            product,
            variant_id=variant_id,
            quantity=item.quantity,
            from_holder_type=HolderType.COURIER_TR,
            to_holder_type=HolderType.WAREHOUSE_TR,
            to_holder_id=0,
            event_type=CustodyEventType.WAREHOUSE_TR_RECEIVED,
            scanned_by=user.id,
        )
    return OkResponse(ok=True)


# ─── Walk-in mijoz ──────────────────────────────────────────────────────────────


@router.post("/walk-in", response_model=OkResponse)
async def walk_in(
    body: WalkInRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> OkResponse:
    db.add(
        WalkInCustomer(
            name=body.name,
            phone=body.phone,
            note=body.note,
            created_by=user.id,
        )
    )
    await db.flush()
    return OkResponse(ok=True)


# ─── UZ ombori mahsulotlari (read-only, box_weight KO'RINADI) ────────────────────


@router.get("/uz-products", response_model=list[ProductOut])
async def uz_products(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> list[ProductOut]:
    rows = await db.execute(
        select(Product)
        .options(selectinload(Product.variants))
        .where(Product.status == ProductStatus.IN_WAREHOUSE_UZ)
        .order_by(Product.created_at.desc())
    )
    # warehouse_tr box_weight_kg ni KO'RA OLADI (firewall yo'q)
    return [product_to_out(p, expose_box_weight=True) for p in rows.scalars().all()]


# ─── Kunlik kelgan yuklar hisoboti ──────────────────────────────────────────────


@router.get("/daily-in", response_model=DailyOutReport)
async def daily_in(
    date_str: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> DailyOutReport:
    """Turkiya omboriga kunlik KELGAN yuklar (default bugun)."""
    day = date.fromisoformat(date_str) if date_str else date.today()
    return await build_daily_out(db, day=day, to_types=[HolderType.WAREHOUSE_TR])


# ─── Skladda turgan yuklar ──────────────────────────────────────────────────────


@router.get("/held", response_model=list[HeldCargoItem])
async def held(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> list[HeldCargoItem]:
    """Turkiya omborida hozir turgan yuklar — har o'lcham alohida (custody WAREHOUSE_TR)."""
    rows = await db.execute(
        select(CustodyHolding, Product, ProductVariant)
        .join(Product, Product.id == CustodyHolding.product_id)
        .join(ProductVariant, ProductVariant.id == CustodyHolding.variant_id)
        .where(
            CustodyHolding.holder_type == HolderType.WAREHOUSE_TR,
            CustodyHolding.quantity > 0,
        )
        .order_by(Product.created_at.desc())
    )
    return [
        HeldCargoItem(
            product_id=p.id,
            barcode=p.barcode,
            product_name=p.name,
            type=p.type,
            size_label=v.size_label,
            quantity=h.quantity,
        )
        for h, p, v in rows.all()
    ]


# ─── Jarayondagi (yo'ldagi) yuklar — hali TR omborga yetmagan ───────────────────


@router.get("/incoming", response_model=list[HeldCargoItem])
async def incoming(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> list[HeldCargoItem]:
    """Hozir yo'lda turgan, hali Turkiya omboriga yetmagan yuklar.

    Yo'lovchida (CARRIER) yoki Turkiya kuryerida (COURIER_TR) turgan custody —
    har o'lcham alohida, qaysi bosqichda ekani (stage_label) bilan.
    """
    in_transit = (HolderType.CARRIER, HolderType.COURIER_TR)
    rows = await db.execute(
        select(CustodyHolding, Product, ProductVariant, User)
        .join(Product, Product.id == CustodyHolding.product_id)
        .join(ProductVariant, ProductVariant.id == CustodyHolding.variant_id)
        .outerjoin(User, User.id == CustodyHolding.holder_id)
        .where(
            CustodyHolding.holder_type.in_(in_transit),
            CustodyHolding.quantity > 0,
        )
        .order_by(CustodyHolding.holder_type, CustodyHolding.holder_id, Product.created_at.desc())
    )
    data = rows.all()

    # Har yo'lovchining (CARRIER) eng so'nggi buyurtmasidan reys ma'lumoti
    carrier_ids = {
        h.holder_id for h, _, _, _ in data if h.holder_type == HolderType.CARRIER and h.holder_id
    }
    flights: dict[int, Order] = {}
    if carrier_ids:
        order_rows = await db.execute(
            select(Order)
            .where(Order.carrier_id.in_(carrier_ids))
            .order_by(Order.carrier_id, Order.created_at.desc())
        )
        for o in order_rows.scalars().all():
            flights.setdefault(o.carrier_id, o)  # birinchi = eng yangi

    result: list[HeldCargoItem] = []
    for h, p, v, u in data:
        order = flights.get(h.holder_id)
        result.append(
            HeldCargoItem(
                product_id=p.id,
                barcode=p.barcode,
                product_name=p.name,
                type=p.type,
                size_label=v.size_label,
                quantity=h.quantity,
                stage_label=STAGE_LABELS.get(h.holder_type, ""),
                holder_id=h.holder_id,
                holder_name=f"{u.first_name} {u.last_name}".strip() if u else "",
                holder_number=u.carrier_number if u else None,
                holder_phone=u.phone if u else "",
                holder_username=u.username if u else None,
                holder_telegram_id=u.telegram_id if u else None,
                flight_date=order.flight_date.isoformat() if order and order.flight_date else None,
                flight_number=order.flight_number if order else None,
                delivery_address_tr=order.delivery_address_tr if order else "",
            )
        )
    return result
