from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import require_role
from app.bot.notify import on_new_order
from app.core.enums import (
    CustodyEventType,
    HolderType,
    ProductStatus,
    Role,
)
from app.core.errors import AppError
from app.core.limiter import limiter
from app.core.security import create_access_token
from app.db.base import get_db
from app.db.models import (
    CustodyEvent,
    CustodyHolding,
    Order,
    PendingHandover,
    Product,
    ProductVariant,
    User,
)
from app.schemas.auth import UserOut
from app.schemas.common import OkResponse, OrderCreatedResponse
from app.schemas.order import (
    CarrierMyProduct,
    CarrierOrderOut,
    ConfirmHandoverRequest,
    CourierBrief,
    CreateOrderRequest,
    OrderItemOut,
    PendingHandoverItemOut,
    PendingHandoverOut,
)
from app.schemas.serializers import product_to_out
from app.services.custody_service import resolve_variant_id, transfer_custody
from app.services.order_service import create_order, list_carrier_orders

router = APIRouter(tags=["carrier"])


@router.get("/products/catalog")
async def catalog(
    max_weight: float | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(Role.CARRIER)),
):
    """Yo'lovchi olib keta oladigan mahsulotlar (in_warehouse_uz, kg limitiga mos)."""
    stmt = (
        select(Product)
        .options(selectinload(Product.variants))
        .where(Product.status == ProductStatus.IN_WAREHOUSE_UZ)
    )
    if max_weight is not None:
        # unit_weight_kg (donali) yoki weight_kg (kiloli) limitidan og'ir bo'lmagani
        stmt = stmt.where(
            (Product.unit_weight_kg.is_(None)) | (Product.unit_weight_kg <= max_weight)
        )
    stmt = stmt.order_by(Product.created_at.desc())
    rows = await db.execute(stmt)
    # Firewall: carrier box_weight_kg ko'rmaydi
    return [product_to_out(p, expose_box_weight=False) for p in rows.scalars().all()]


@router.post("/carrier/orders", response_model=OrderCreatedResponse)
@limiter.limit("15/minute")
async def create_carrier_order(
    request: Request,
    body: CreateOrderRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(Role.CARRIER)),
) -> OrderCreatedResponse:
    order = await create_order(db, user.id, body)
    await on_new_order(
        db,
        carrier_name=f"{user.first_name} {user.last_name}".strip(),
        order_id=order.id,
    )
    return OrderCreatedResponse(ok=True, order_id=order.id)


@router.get("/carrier/orders", response_model=list[CarrierOrderOut])
async def my_orders(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(Role.CARRIER)),
) -> list[CarrierOrderOut]:
    orders = await list_carrier_orders(db, user.id)
    result: list[CarrierOrderOut] = []
    for o in orders:
        products = [product_to_out(it.product, expose_box_weight=False) for it in o.items]
        items = [
            OrderItemOut(
                product_id=it.product_id,
                variant_id=it.variant_id,
                size_label=it.variant.size_label if it.variant else "",
                product_name=it.product.name,
                type=it.product.type,
                amount=float(it.amount),
                actual_quantity=it.actual_quantity,
                actual_kg=float(it.actual_kg) if it.actual_kg is not None else None,
                confirmed=it.actual_quantity is not None,
            )
            for it in o.items
        ]
        result.append(
            CarrierOrderOut(
                id=o.id,
                carrier_id=o.carrier_id,
                products=products,
                items=items,
                pickup_type=o.pickup_type,
                pickup_address=o.pickup_address,
                delivery_address_tr=o.delivery_address_tr,
                flight_date=o.flight_date,
                flight_number=o.flight_number,
                status=o.status,
                created_at=o.created_at.date().isoformat(),
            )
        )
    return result


@router.get("/carrier/my-products", response_model=list[CarrierMyProduct])
async def my_products(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(Role.CARRIER)),
) -> list[CarrierMyProduct]:
    """Yo'lovchi hozir o'zida olib yurgan yuklar — kuryer aeroportда topshirganlari.
    custody_holdings dan (CARRIER, holder_id=shu yo'lovchi, quantity>0), har o'lcham alohida."""
    rows = await db.execute(
        select(CustodyHolding, Product, ProductVariant)
        .join(Product, Product.id == CustodyHolding.product_id)
        .join(ProductVariant, ProductVariant.id == CustodyHolding.variant_id)
        .where(
            CustodyHolding.holder_type == HolderType.CARRIER,
            CustodyHolding.holder_id == user.id,
            CustodyHolding.quantity > 0,
        )
    )
    holdings = rows.all()
    if not holdings:
        return []

    product_ids = list({p.id for _, p, _ in holdings})

    # Qachon qabul qilingani (AIRPORT_HANDOVER eventi sanasi)
    ev_rows = await db.execute(
        select(CustodyEvent.product_id, CustodyEvent.created_at)
        .where(
            CustodyEvent.product_id.in_(product_ids),
            CustodyEvent.event_type == CustodyEventType.AIRPORT_HANDOVER,
        )
        .order_by(CustodyEvent.id.desc())
    )
    received_at: dict[int, str] = {}
    for pid, created in ev_rows.all():
        received_at.setdefault(pid, created.date().isoformat())

    return [
        CarrierMyProduct(
            product_id=p.id,
            barcode=p.barcode,
            product_name=p.name,
            category=p.category,
            image_url=p.image_url,
            size_label=v.size_label,
            quantity=h.quantity,
            received_at=received_at.get(p.id, ""),
        )
        for h, p, v in holdings
    ]


@router.get("/carrier/pending-handovers", response_model=list[PendingHandoverOut])
async def pending_handovers(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(Role.CARRIER)),
) -> list[PendingHandoverOut]:
    """Kuryer topshirmoqchi, lekin yo'lovchi hali tasdiqlamagan yuklar."""
    rows = await db.execute(
        select(PendingHandover)
        .where(PendingHandover.carrier_id == user.id, PendingHandover.status == "pending")
        .order_by(PendingHandover.id.desc())
    )
    pendings = list(rows.scalars().all())
    if not pendings:
        return []

    # Barkodlar bo'yicha mahsulot nomi/rasm va variant o'lchamini olamiz
    barcodes = {it["barcode"] for p in pendings for it in p.items}
    prod_rows = await db.execute(
        select(Product).options(selectinload(Product.variants)).where(Product.barcode.in_(barcodes))
    )
    by_barcode = {p.barcode: p for p in prod_rows.scalars().all()}

    result: list[PendingHandoverOut] = []
    for p in pendings:
        courier = await db.get(User, p.courier_id)
        items_out: list[PendingHandoverItemOut] = []
        total = 0
        for it in p.items:
            prod = by_barcode.get(it["barcode"])
            size_label = ""
            if prod and it.get("variant_id"):
                v = next((vv for vv in prod.variants if vv.id == it["variant_id"]), None)
                size_label = v.size_label if v else ""
            items_out.append(
                PendingHandoverItemOut(
                    barcode=it["barcode"],
                    product_name=prod.name if prod else it["barcode"],
                    image_url=prod.image_url if prod else None,
                    size_label=size_label,
                    quantity=it["quantity"],
                )
            )
            total += it["quantity"]
        result.append(
            PendingHandoverOut(
                id=p.id,
                courier_name=f"{courier.first_name} {courier.last_name}".strip() if courier else "",
                total=total,
                created_at=p.created_at.isoformat(),
                items=items_out,
            )
        )
    return result


@router.post("/carrier/confirm-handover", response_model=OkResponse)
async def confirm_handover(
    body: ConfirmHandoverRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(Role.CARRIER)),
) -> OkResponse:
    """Yo'lovchi pending topshiriqni tasdiqlaydi: Turkiya manzili + reys raqami
    kiritilgach, custody COURIER_UZ -> CARRIER ga o'tadi va eng so'nggi buyurtmaga
    manzil/reys yoziladi."""
    pending = await db.get(PendingHandover, body.pending_id)
    if pending is None or pending.carrier_id != user.id or pending.status != "pending":
        raise AppError("PENDING_NOT_FOUND", "Tasdiqlanadigan topshiriq topilmadi", status_code=404)

    for it in pending.items:
        product = await db.scalar(
            select(Product)
            .options(selectinload(Product.variants))
            .where(Product.barcode == it["barcode"])
        )
        if product is None:
            raise AppError("BARCODE_NOT_FOUND", f"Barkod topilmadi: {it['barcode']}")
        variant_id = await resolve_variant_id(db, product=product, variant_id=it.get("variant_id"))
        await transfer_custody(
            db,
            product,
            variant_id=variant_id,
            quantity=it["quantity"],
            from_holder_type=HolderType.COURIER_UZ,
            from_holder_id=pending.courier_id,
            to_holder_type=HolderType.CARRIER,
            to_holder_id=user.id,
            event_type=CustodyEventType.AIRPORT_HANDOVER,
            scanned_by=user.id,
        )

    # Yo'lovchi kiritgan Turkiya manzili + reysni eng so'nggi buyurtmaga yozamiz
    last_order = await db.scalar(
        select(Order).where(Order.carrier_id == user.id).order_by(Order.id.desc()).limit(1)
    )
    if last_order is not None:
        last_order.delivery_address_tr = body.delivery_address_tr
        last_order.flight_number = body.flight_number
        if body.flight_date is not None:
            last_order.flight_date = body.flight_date

    pending.status = "confirmed"
    await db.flush()
    return OkResponse(ok=True)


@router.get("/couriers/uz/active", response_model=list[CourierBrief])
async def active_uz_couriers(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(Role.CARRIER)),
) -> list[CourierBrief]:
    rows = await db.execute(
        select(User).where(User.role == Role.COURIER_UZ, User.is_active.is_(True))
    )
    return [
        CourierBrief(id=c.id, first_name=c.first_name, last_name=c.last_name)
        for c in rows.scalars().all()
    ]


class LeaveRoleResponse(OkResponse):
    token: str
    user: UserOut


@router.post("/carrier/leave-role", response_model=LeaveRoleResponse)
async def leave_role(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(Role.CARRIER)),
) -> LeaveRoleResponse:
    """Yo'lovchi rolidan chiqish — faqat barcha yuklari WITH_CARRIER emas yoki DELIVERED_TR bo'lsa.
    Shartlar: hech qanday faol yuki qolmagan bo'lishi kerak
    (pending_admin, confirmed, with_courier_uz, with_carrier).
    """
    # Yo'lovchida hozir yuk turgan bo'lsa (CARRIER holding) — chiqib bo'lmaydi
    active_count = await db.scalar(
        select(func.count())
        .select_from(CustodyHolding)
        .where(
            CustodyHolding.holder_type == HolderType.CARRIER,
            CustodyHolding.holder_id == user.id,
            CustodyHolding.quantity > 0,
        )
    )
    if active_count and active_count > 0:
        raise AppError(
            "HAS_ACTIVE_GOODS",
            "Hisobingizda hali yo'lda yoki omborida turgan yuklaringiz bor. "
            "Barcha yuklarni Turkiya kuryeriga topshirgandan keyin chiqishingiz mumkin.",
            status_code=400,
        )

    user.role = Role.NEW
    await db.flush()
    await db.refresh(user)
    token = create_access_token(user.id, str(user.role))
    return LeaveRoleResponse(
        ok=True,
        token=token,
        user=UserOut.model_validate(user, from_attributes=True),
    )
