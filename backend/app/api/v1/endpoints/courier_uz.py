from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import require_role
from app.bot import notify
from app.core.enums import (
    CustodyEventType,
    HolderType,
    OrderStatus,
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
    ScanAirportRequest,
)
from app.schemas.warehouse import (
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
    """Kuryer yo'lovchiga topshiradi — yuk DARHOL yo'lovchiga o'tadi.

    Yo'lovchining qabul tasdig'i shart emas: custody COURIER_UZ -> CARRIER ga
    darhol ko'chadi va yuk yo'lovchining "Yuklarim" bo'limida ko'rinadi.
    """
    carrier = await _find_carrier_by_number(db, body.carrier_number)
    total = 0
    product_ids: list[int] = []
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
        # Kuryerdan (COURIER_UZ, user.id) yo'lovchiga (CARRIER, carrier.id) DARHOL
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
        total += item.quantity
        product_ids.append(product.id)

    # Yuk yo'lovchiga o'tdi — tegishli buyurtmalar holati "Yuk sizda" (WITH_CARRIER) ga
    if product_ids:
        orders = (
            (
                await db.execute(
                    select(Order)
                    .join(OrderItem, OrderItem.order_id == Order.id)
                    .where(
                        Order.carrier_id == carrier.id,
                        OrderItem.product_id.in_(product_ids),
                        Order.status == OrderStatus.CONFIRMED,
                    )
                    .distinct()
                )
            )
            .scalars()
            .unique()
        )
        for o in orders:
            o.status = OrderStatus.WITH_CARRIER

    await notify.on_airport_handover_done(db, carrier_id=carrier.id, count=total)
    return OkResponse(ok=True)
