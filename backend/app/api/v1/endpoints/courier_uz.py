from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import require_role
from app.core.enums import (
    CustodyEventType,
    HolderType,
    OrderStatus,
    PickupType,
    ProductStatus,
    Role,
)
from app.core.errors import AppError
from app.db.base import get_db
from app.db.models import (
    CustodyEvent,
    CustodyHolding,
    Order,
    OrderItem,
    Product,
    ProductVariant,
    User,
)
from app.schemas.common import OkResponse
from app.schemas.courier import (
    ConfirmAirportRequest,
    CourierUzMyProduct,
    CourierUzQueueItem,
    CourierUzQueueProduct,
    ScanAirportRequest,
)
from app.schemas.warehouse import (
    ConfirmRequest,
    ScanRequest,
    ScanResponse,
    VariantAvailability,
)
from app.services.custody_service import (
    availability_for_holder,
    resolve_variant_id,
    transfer_custody,
)

router = APIRouter(prefix="/courier-uz", tags=["courier_uz"])

ROLE = (Role.COURIER_UZ,)


@router.get("/queue", response_model=list[CourierUzQueueItem])
async def queue(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> list[CourierUzQueueItem]:
    """Kuryer olib kelishi kerak bo'lgan buyurtmalar (pickup_type=courier).

    Skladchidagidek buyurtma kartalari: mahsulotlar ro'yxati + olib ketilganmi.
    Olib ketilgan buyurtma o'chmaydi — '(ism) tasdiqladi' bo'lib qoladi.
    """
    orders = (
        (
            await db.execute(
                select(Order)
                .where(
                    Order.pickup_type == PickupType.COURIER,
                    Order.status.in_([OrderStatus.CONFIRMED, OrderStatus.PENDING_ADMIN]),
                )
                .options(
                    selectinload(Order.items).selectinload(OrderItem.product),
                    selectinload(Order.items).selectinload(OrderItem.variant),
                    selectinload(Order.carrier),
                )
                .order_by(Order.created_at.desc())
            )
        )
        .scalars()
        .all()
    )

    # Kuryer olib ketganini aniqlash: yuk kuryerga o'tgan yoki undan keyingi bosqichda.
    # (WITH_CARRIER/DELIVERED_TR ham — kuryer allaqachon olib bo'lgan demakdir.)
    PICKED_STATES = (
        ProductStatus.WITH_COURIER_UZ,
        ProductStatus.WITH_CARRIER,
        ProductStatus.DELIVERED_TR,
    )

    # Qaysi kuryer olib ketganini custody_events (COURIER_UZ_PICKUP) dan topamiz —
    # WITH_CARRIER bo'lgach ham kuryer ismi saqlanadi (custody hozirgi egasi emas).
    product_ids = [it.product_id for o in orders for it in o.items]
    pickup_by_product: dict[int, int] = {}
    couriers: dict[int, User] = {}
    if product_ids:
        ev_rows = await db.execute(
            select(CustodyEvent.product_id, CustodyEvent.scanned_by)
            .where(
                CustodyEvent.product_id.in_(product_ids),
                CustodyEvent.event_type == CustodyEventType.COURIER_UZ_PICKUP,
                CustodyEvent.scanned_by.is_not(None),
            )
            .order_by(CustodyEvent.id.asc())
        )
        for pid, sb in ev_rows.all():
            pickup_by_product[pid] = sb  # oxirgi pickup eventi (eng katta id) qoladi
        # Kuryer ismlari — bitta so'rovda
        courier_ids = list(set(pickup_by_product.values()))
        if courier_ids:
            crows = await db.execute(select(User).where(User.id.in_(courier_ids)))
            couriers = {u.id: u for u in crows.scalars().all()}

    result: list[CourierUzQueueItem] = []
    for order in orders:
        carrier = order.carrier
        products = [
            CourierUzQueueProduct(
                barcode=it.product.barcode,
                product_name=it.product.name,
                size_label=it.variant.size_label if it.variant else "",
                picked_up=it.product.status in PICKED_STATES,
                variant_id=it.variant_id,
                # Ombor tasdiqlagan haqiqiy miqdor (yo'q bo'lsa so'ralgan amount)
                quantity=it.actual_quantity or int(it.amount) or 1,
            )
            for it in order.items
        ]
        all_picked = bool(products) and all(p.picked_up for p in products)

        # Olib ketgan kuryer ismi (custody_events COURIER_UZ_PICKUP dan)
        confirmed_by_name: str | None = None
        if all_picked:
            courier_id = next(
                (
                    pickup_by_product.get(it.product_id)
                    for it in order.items
                    if pickup_by_product.get(it.product_id) is not None
                ),
                None,
            )
            holder = couriers.get(courier_id) if courier_id is not None else None
            if holder is not None:
                confirmed_by_name = f"{holder.first_name} {holder.last_name}".strip()

        result.append(
            CourierUzQueueItem(
                id=order.id,
                carrier_name=f"{carrier.first_name} {carrier.last_name}".strip(),
                carrier_number=carrier.carrier_number,
                address=order.pickup_address or "",
                products_count=len(products),
                status="done" if all_picked else "pending",
                products=products,
                confirmed_by_name=confirmed_by_name,
                created_at=order.created_at.date().isoformat(),
            )
        )
    return result


# ─── Ombordan olish ─────────────────────────────────────────────────────────────


@router.post("/scan-pickup", response_model=ScanResponse)
async def scan_pickup(
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
    # Ombordan (WAREHOUSE_UZ, 0) olish — shu egada nechta qolgan
    avail = await availability_for_holder(
        db, product=product, holder_type=HolderType.WAREHOUSE_UZ, holder_id=0
    )
    if not avail:
        raise AppError(
            "INVALID_PRODUCT_STATE",
            "Omborda bu yukdan qolmagan yoki allaqachon olingan",
        )
    return ScanResponse(
        barcode=product.barcode,
        product_name=product.name,
        quantity=sum(a[2] for a in avail),
        available_by_variant=[
            VariantAvailability(variant_id=vid, size_label=sl, available=q) for vid, sl, q in avail
        ],
    )


@router.post("/confirm-pickup", response_model=OkResponse)
async def confirm_pickup(
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
        # Ombordan (WAREHOUSE_UZ, 0) kuryerning o'ziga
        await transfer_custody(
            db,
            product,
            variant_id=variant_id,
            quantity=item.quantity,
            from_holder_type=HolderType.WAREHOUSE_UZ,
            from_holder_id=0,
            to_holder_type=HolderType.COURIER_UZ,
            to_holder_id=user.id,
            event_type=CustodyEventType.COURIER_UZ_PICKUP,
            scanned_by=user.id,
        )
    return OkResponse(ok=True)


# ─── Mening yuklarim (kuryer hozir olib yurgan) ─────────────────────────────────


@router.get("/my-products", response_model=list[CourierUzMyProduct])
async def my_products(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> list[CourierUzMyProduct]:
    """Kuryer hozir o'zida olib yurgan yuklar — har o'lcham (variant) alohida,
    custody_holdings dan (COURIER_UZ, holder_id=shu kuryer, quantity>0)."""
    rows = await db.execute(
        select(CustodyHolding, Product, ProductVariant)
        .join(Product, Product.id == CustodyHolding.product_id)
        .join(ProductVariant, ProductVariant.id == CustodyHolding.variant_id)
        .where(
            CustodyHolding.holder_type == HolderType.COURIER_UZ,
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

    # Qachon olib ketilgani (COURIER_UZ_PICKUP eventi sanasi)
    ev_rows = await db.execute(
        select(CustodyEvent.product_id, CustodyEvent.created_at)
        .where(
            CustodyEvent.product_id.in_(product_ids),
            CustodyEvent.event_type == CustodyEventType.COURIER_UZ_PICKUP,
        )
        .order_by(CustodyEvent.id.desc())
    )
    picked_at: dict[int, str] = {}
    for pid, created in ev_rows.all():
        picked_at.setdefault(pid, created.date().isoformat())

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
                picked_up_at=picked_at.get(p.id, ""),
                size_label=v.size_label,
                quantity=h.quantity,
            )
        )
    return result


# ─── Aeroportda yo'lovchiga topshirish ──────────────────────────────────────────


async def _find_carrier_by_number(db: AsyncSession, carrier_number: int) -> User:
    carrier = await db.scalar(
        select(User).where(
            User.carrier_number == carrier_number,
            User.role == Role.CARRIER,
            User.is_active.is_(True),
        )
    )
    if carrier is None:
        raise AppError("CARRIER_NOT_FOUND", "Yo'lovchi topilmadi yoki faol emas", status_code=400)
    return carrier


async def _ensure_can_handover(db: AsyncSession, product_id: int, carrier_id: int) -> None:
    """Yukni shu yo'lovchiga topshirish mumkinligini tekshiradi.

    - Buyurtmali yuk (biror buyurtmaga biriktirilgan) — faqat o'sha yo'lovchiga.
    - Buyurtmasiz yuk (hech qaysi buyurtmada yo'q) — istalgan yo'lovchiga ruxsat
      (kuryer buyurtmadan tashqari olib kelgan yuklar).
    """
    # Bu yuk umuman biror buyurtmadami?
    in_any_order = await db.scalar(
        select(OrderItem.id).where(OrderItem.product_id == product_id).limit(1)
    )
    if in_any_order is None:
        # Buyurtmasiz yuk — istalgan yo'lovchiga berish mumkin
        return

    # Buyurtmali yuk — faqat o'z buyurtmasi egasiga
    linked = await db.scalar(
        select(OrderItem.id)
        .join(Order, Order.id == OrderItem.order_id)
        .where(OrderItem.product_id == product_id, Order.carrier_id == carrier_id)
        .limit(1)
    )
    if linked is None:
        raise AppError(
            "NOT_CARRIERS_PRODUCT",
            "Bu yuk boshqa yo'lovchining buyurtmasiga tegishli",
            status_code=400,
        )


@router.post("/scan-airport", response_model=ScanResponse)
async def scan_airport(
    body: ScanAirportRequest,
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
    # Kuryer o'zida (COURIER_UZ, holder_id=user.id) nechta bor
    avail = await availability_for_holder(
        db, product=product, holder_type=HolderType.COURIER_UZ, holder_id=user.id
    )
    if not avail:
        raise AppError(
            "NOT_YOUR_PRODUCT",
            "Bu yukdan sizda yo'q — topshirib bo'lmaydi",
            status_code=400,
        )
    carrier = await _find_carrier_by_number(db, body.carrier_number)
    await _ensure_can_handover(db, product.id, carrier.id)
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


@router.post("/confirm-airport", response_model=OkResponse)
async def confirm_airport(
    body: ConfirmAirportRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> OkResponse:
    carrier = await _find_carrier_by_number(db, body.carrier_number)
    for item in body.items:
        product = await db.scalar(
            select(Product)
            .options(selectinload(Product.variants))
            .where(Product.barcode == item.barcode)
        )
        if product is None:
            raise AppError("BARCODE_NOT_FOUND", f"Barkod topilmadi: {item.barcode}")
        variant_id = await resolve_variant_id(db, product=product, variant_id=item.variant_id)
        # Buyurtmali yuk faqat egasiga; buyurtmasiz yuk istalgan yo'lovchiga
        await _ensure_can_handover(db, product.id, carrier.id)
        # Kuryerning o'zidan (COURIER_UZ, user.id) yo'lovchiga
        await transfer_custody(
            db,
            product,
            variant_id=variant_id,
            quantity=item.quantity,
            from_holder_type=HolderType.COURIER_UZ,
            from_holder_id=user.id,
            to_holder_type=HolderType.CARRIER,
            to_holder_id=carrier.id,
            event_type=CustodyEventType.AIRPORT_HANDOVER,
            scanned_by=user.id,
        )
    return OkResponse(ok=True)
