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
    Product,
    ProductVariant,
    User,
)
from app.schemas.auth import UserOut
from app.schemas.common import OkResponse, OrderCreatedResponse
from app.schemas.order import (
    CarrierMyProduct,
    CarrierOrderOut,
    CourierBrief,
    CreateOrderRequest,
    OrderItemOut,
)
from app.schemas.serializers import product_to_out
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
