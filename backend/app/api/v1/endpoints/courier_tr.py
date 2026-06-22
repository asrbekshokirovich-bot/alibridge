from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import require_role
from app.bot import notify
from app.bot.notify import on_damage_reported
from app.core.enums import (
    CustodyEventType,
    DisputeStatus,
    HolderType,
    ProductStatus,
    Role,
)
from app.core.errors import AppError
from app.db.base import get_db
from app.db.models import (
    CustodyEvent,
    CustodyHolding,
    Dispute,
    Order,
    OrderItem,
    Product,
    ProductVariant,
    User,
)
from app.schemas.common import OkResponse
from app.schemas.courier import (
    CarrierProductItem,
    ConfirmDeliveryRequest,
    CourierUzMyProduct,
    DeliveryItem,
    ReceiveConfirmRequest,
    ReceiveScanRequest,
    ReportDamagedRequest,
    ScanDeliveryRequest,
)
from app.schemas.warehouse import (
    ConfirmRequest,
    ScanRequest,
    ScanResponse,
    VariantAvailability,
)
from app.services.custody_service import (
    availability_by_type,
    availability_for_holder,
    drain_from_type,
    get_product_by_barcode,
    is_fully_arrived,
    resolve_variant_id,
    transfer_custody,
)
from app.services.payment_service import recompute_carrier_payment


async def _scan_avail(
    db: AsyncSession, barcode: str, holder_type: HolderType
) -> tuple[Product, list[tuple[int, str, int]], User | None]:
    """Scan yordamchisi: product + manba turdagi mavjudlik + yo'lovchi."""
    product = await db.scalar(
        select(Product).options(selectinload(Product.variants)).where(Product.barcode == barcode)
    )
    if product is None:
        raise AppError("BARCODE_NOT_FOUND", "Barkod topilmadi", status_code=400)
    avail = await availability_by_type(db, product=product, holder_type=holder_type)
    if not avail:
        raise AppError("INVALID_PRODUCT_STATE", "Bu yukdan bu bosqichda qolmagan")
    carrier = await _carrier_for_product(db, product.id)
    return product, avail, carrier


router = APIRouter(prefix="/courier-tr", tags=["courier_tr"])

ROLE = (Role.COURIER_TR,)


async def _carrier_for_product(db: AsyncSession, product_id: int) -> User | None:
    return await db.scalar(
        select(User)
        .join(Order, Order.carrier_id == User.id)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(OrderItem.product_id == product_id)
        .limit(1)
    )


# ─── O'zbekistondan kelgan yuklarni qabul ───────────────────────────────────────


async def _get_carrier_by_number(db: AsyncSession, carrier_number: int) -> User:
    carrier = await db.scalar(select(User).where(User.carrier_number == carrier_number))
    if carrier is None:
        raise AppError(
            "CARRIER_NOT_FOUND", f"Yo'lovchi #{carrier_number} topilmadi", status_code=404
        )
    return carrier


@router.get("/carrier-products", response_model=list[CarrierProductItem])
async def carrier_products(
    carrier_number: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> list[CarrierProductItem]:
    """Yo'lovchi raqami bo'yicha uning CARRIER custody'sidagi yuklarni qaytaradi."""
    carrier = await _get_carrier_by_number(db, carrier_number)
    rows = await db.execute(
        select(CustodyHolding, Product, ProductVariant)
        .join(Product, Product.id == CustodyHolding.product_id)
        .join(ProductVariant, ProductVariant.id == CustodyHolding.variant_id)
        .where(
            CustodyHolding.holder_type == HolderType.CARRIER,
            CustodyHolding.holder_id == carrier.id,
            CustodyHolding.quantity > 0,
        )
    )
    result: list[CarrierProductItem] = []
    for h, p, v in rows.all():
        result.append(
            CarrierProductItem(
                product_id=p.id,
                variant_id=v.id,
                barcode=p.barcode,
                product_name=p.name,
                category=p.category,
                image_url=p.image_url,
                size_label=v.size_label,
                quantity=h.quantity,
            )
        )
    return result


@router.post("/scan-receive", response_model=ScanResponse)
async def scan_receive(
    body: ReceiveScanRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> ScanResponse:
    """Aniq yo'lovchining CARRIER custody'sidan barkodni tekshiradi."""
    carrier = await _get_carrier_by_number(db, body.carrier_number)
    product = await db.scalar(
        select(Product)
        .options(selectinload(Product.variants))
        .where(Product.barcode == body.barcode)
    )
    if product is None:
        raise AppError("BARCODE_NOT_FOUND", "Barkod topilmadi", status_code=400)
    avail = await availability_for_holder(
        db, product=product, holder_type=HolderType.CARRIER, holder_id=carrier.id
    )
    if not avail:
        raise AppError("INVALID_PRODUCT_STATE", "Bu yuk shu yo'lovchida topilmadi")
    return ScanResponse(
        barcode=product.barcode,
        product_name=product.name,
        carrier_name=f"{carrier.first_name} {carrier.last_name}".strip(),
        carrier_number=carrier.carrier_number,
        quantity=sum(a[2] for a in avail),
        available_by_variant=[
            VariantAvailability(variant_id=vid, size_label=sl, available=q) for vid, sl, q in avail
        ],
    )


@router.post("/confirm-receive", response_model=OkResponse)
async def confirm_receive(
    body: ReceiveConfirmRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> OkResponse:
    """Skanlangan yuklarni aniq yo'lovchidan (CARRIER holder_id) COURIER_TR ga o'tkazadi."""
    carrier = await _get_carrier_by_number(db, body.carrier_number)
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
            from_holder_type=HolderType.CARRIER,
            from_holder_id=carrier.id,
            to_holder_type=HolderType.COURIER_TR,
            to_holder_id=user.id,
            event_type=CustodyEventType.COURIER_TR_RECEIVED,
            scanned_by=user.id,
        )

    await recompute_carrier_payment(db, carrier.id)
    return OkResponse(ok=True)


# ─── Turkiya omboriga topshirish ────────────────────────────────────────────────


@router.post("/scan-handover-warehouse", response_model=ScanResponse)
async def scan_handover_warehouse(
    body: ScanRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> ScanResponse:
    """Omborga topshirishdan oldin barkodni tekshirish (manba: TR kuryer)."""
    product, avail, carrier = await _scan_avail(db, body.barcode, HolderType.COURIER_TR)
    return ScanResponse(
        barcode=product.barcode,
        product_name=product.name,
        carrier_name=f"{carrier.first_name} {carrier.last_name}".strip() if carrier else None,
        carrier_number=carrier.carrier_number if carrier else None,
        quantity=sum(a[2] for a in avail),
        available_by_variant=[
            VariantAvailability(variant_id=vid, size_label=sl, available=q) for vid, sl, q in avail
        ],
    )


@router.post("/confirm-handover-warehouse", response_model=OkResponse)
async def confirm_handover_warehouse(
    body: ConfirmRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> OkResponse:
    """Kuryer yukni Turkiya omboriga topshiradi — custody ombor (WAREHOUSE_TR) ga o'tadi."""
    for item in body.items:
        product = await db.scalar(
            select(Product)
            .options(selectinload(Product.variants))
            .where(Product.barcode == item.barcode)
        )
        if product is None:
            raise AppError("BARCODE_NOT_FOUND", f"Barkod topilmadi: {item.barcode}")
        variant_id = await resolve_variant_id(db, product=product, variant_id=item.variant_id)
        # Yuk COURIER_TR'da bir nechta holder_id'ga bo'linган bo'lishi mumkin —
        # o'zida (user.id) va ombordan kelgan (holder_id=0). Hammasidan yig'ib olamiz.
        await drain_from_type(
            db,
            product,
            variant_id=variant_id,
            quantity=item.quantity,
            from_holder_type=HolderType.COURIER_TR,
            to_holder_type=HolderType.WAREHOUSE_TR,
            to_holder_id=0,  # umumiy Turkiya ombori (aniq xodim emas)
            event_type=CustodyEventType.WAREHOUSE_TR_RECEIVED,
            scanned_by=user.id,
        )
        # Bu mahsulotning hammasi TR omborga yetdimi?
        if await is_fully_arrived(db, product.id):
            carrier = await _carrier_for_product(db, product.id)
            await notify.on_all_arrived(
                db,
                barcode=product.barcode,
                product_name=product.name,
                carrier_id=carrier.id if carrier else None,
            )
    return OkResponse(ok=True)


# ─── Shikastlangan yuk ──────────────────────────────────────────────────────────


@router.post("/report-damaged", response_model=OkResponse)
async def report_damaged(
    body: ReportDamagedRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> OkResponse:
    product = await get_product_by_barcode(db, body.barcode)
    carrier = await _carrier_for_product(db, product.id)

    db.add(
        Dispute(
            product_id=product.id,
            carrier_id=carrier.id if carrier else None,
            reported_by=user.id,
            barcode=body.barcode,
            note=body.note,
            status=DisputeStatus.OPEN,
        )
    )
    product.status = ProductStatus.DAMAGED
    await db.flush()
    await on_damage_reported(
        db,
        barcode=body.barcode,
        carrier_number=body.carrier_number or (carrier.carrier_number if carrier else None),
        note=body.note,
    )
    return OkResponse(ok=True)


# ─── Mening yuklarim (TR kuryeri hozir olib yurgan) ─────────────────────────────


@router.get("/my-products", response_model=list[CourierUzMyProduct])
async def my_products(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> list[CourierUzMyProduct]:
    """TR kuryeri hozir o'zida olib yurgan yuklar — har o'lcham (variant) alohida,
    custody_holdings dan (COURIER_TR, holder_id=shu kuryer, quantity>0)."""
    rows = await db.execute(
        select(CustodyHolding, Product, ProductVariant)
        .join(Product, Product.id == CustodyHolding.product_id)
        .join(ProductVariant, ProductVariant.id == CustodyHolding.variant_id)
        .where(
            CustodyHolding.holder_type == HolderType.COURIER_TR,
            CustodyHolding.holder_id == user.id,
            CustodyHolding.quantity > 0,
        )
    )
    holdings = rows.all()
    if not holdings:
        return []

    product_ids = list({p.id for _, p, _ in holdings})

    # Har yuk qaysi yo'lovchining buyurtmasiga tegishli (buyurtmasiz bo'lsa null)
    carrier_rows = await db.execute(
        select(OrderItem.product_id, User)
        .join(Order, Order.id == OrderItem.order_id)
        .join(User, User.id == Order.carrier_id)
        .where(OrderItem.product_id.in_(product_ids))
    )
    carrier_by_product: dict[int, User] = {}
    for pid, carrier in carrier_rows.all():
        carrier_by_product.setdefault(pid, carrier)

    # Qachon qabul qilingani (COURIER_TR_RECEIVED eventi sanasi)
    ev_rows = await db.execute(
        select(CustodyEvent.product_id, CustodyEvent.created_at)
        .where(
            CustodyEvent.product_id.in_(product_ids),
            CustodyEvent.event_type == CustodyEventType.COURIER_TR_RECEIVED,
        )
        .order_by(CustodyEvent.id.desc())
    )
    received_at: dict[int, str] = {}
    for pid, created in ev_rows.all():
        received_at.setdefault(pid, created.date().isoformat())

    result: list[CourierUzMyProduct] = []
    for h, p, v in holdings:
        carrier = carrier_by_product.get(p.id)
        result.append(
            CourierUzMyProduct(
                product_id=p.id,
                variant_id=v.id,
                barcode=p.barcode,
                product_name=p.name,
                category=p.category,
                image_url=p.image_url,
                carrier_name=(
                    f"{carrier.first_name} {carrier.last_name}".strip() if carrier else None
                ),
                carrier_number=carrier.carrier_number if carrier else None,
                picked_up_at=received_at.get(p.id, ""),
                size_label=v.size_label,
                quantity=h.quantity,
            )
        )
    return result


# ─── Yetkazish (buyurtmachiga) ──────────────────────────────────────────────────


@router.get("/deliveries", response_model=list[DeliveryItem])
async def deliveries(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> list[DeliveryItem]:
    """Yetkazishga tayyor buyurtmalar — TR omborda (WAREHOUSE_TR) yuki turgani.

    Manba sifatida custody_holdings ishlatiladi (yagona haqiqat) — Order.status
    custody bosqichlarini kuzatmaydi, shuning uchun unga tayanmaymiz.
    """
    # Mahsulot (product_id) bo'yicha join — OrderItem.variant_id NULL bo'lishi
    # mumkin (eski/variantsiz buyurtmalar), shuning uchun variant_id'ni
    # tenglashtirmaymiz (NULL = NULL SQLда FALSE bo'lib buyurtmani yo'qotardi).
    # products_count = TR omborga yetgan mahsulot turlari soni (DISTINCT OrderItem).
    rows = await db.execute(
        select(Order, User, func.count(func.distinct(OrderItem.id)))
        .join(User, User.id == Order.carrier_id)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .join(CustodyHolding, CustodyHolding.product_id == OrderItem.product_id)
        .where(
            CustodyHolding.holder_type == HolderType.WAREHOUSE_TR,
            CustodyHolding.quantity > 0,
        )
        .group_by(Order.id, User.id)
    )
    result: list[DeliveryItem] = []
    for order, carrier, count in rows.all():
        result.append(
            DeliveryItem(
                id=order.id,
                address=order.delivery_address_tr,
                recipient_name=f"{carrier.first_name} {carrier.last_name}".strip(),
                products_count=count,
            )
        )
    return result


@router.post("/scan-delivery", response_model=ScanResponse)
async def scan_delivery(
    body: ScanDeliveryRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> ScanResponse:
    # Manba: TR ombor (WAREHOUSE_TR) — kuryer omborldan olib buyurtmachiga yetkazadi
    product, avail, _ = await _scan_avail(db, body.barcode, HolderType.WAREHOUSE_TR)
    return ScanResponse(
        barcode=product.barcode,
        product_name=product.name,
        quantity=sum(a[2] for a in avail),
        available_by_variant=[
            VariantAvailability(variant_id=vid, size_label=sl, available=q) for vid, sl, q in avail
        ],
    )


@router.post("/confirm-delivery", response_model=OkResponse)
async def confirm_delivery(
    body: ConfirmDeliveryRequest,
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
            to_holder_type=HolderType.ORDERER,
            to_holder_id=0,
            event_type=CustodyEventType.DELIVERED,
            scanned_by=user.id,
        )
    return OkResponse(ok=True)
