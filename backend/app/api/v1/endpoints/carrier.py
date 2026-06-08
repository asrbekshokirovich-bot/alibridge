from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.bot.notify import on_new_order
from app.core.enums import OrderStatus, ProductStatus, Role
from app.core.errors import AppError
from app.core.limiter import limiter
from app.core.security import create_access_token
from app.db.base import get_db
from app.db.models import Order, OrderItem, Product, User
from app.schemas.auth import UserOut
from app.schemas.common import OkResponse, OrderCreatedResponse
from app.schemas.order import (
    AutoReceiveRequest,
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
    stmt = select(Product).where(Product.status == ProductStatus.IN_WAREHOUSE_UZ)
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
                status=o.status,
                created_at=o.created_at.date().isoformat(),
            )
        )
    return result


@router.get("/couriers/uz/active", response_model=list[CourierBrief])
async def active_uz_couriers(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[CourierBrief]:
    rows = await db.execute(
        select(User).where(User.role == Role.COURIER_UZ, User.is_active.is_(True))
    )
    return [
        CourierBrief(id=c.id, first_name=c.first_name, last_name=c.last_name)
        for c in rows.scalars().all()
    ]


@router.post("/carrier/auto-receive", response_model=OkResponse)
async def auto_receive(
    body: AutoReceiveRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(Role.CARRIER)),
) -> OkResponse:
    """Yo'lovchi aeroportda kuryerni tanlaydi (kuryer keyin barkod skanlaydi)."""
    courier = await db.get(User, body.courier_id)
    if courier is None or courier.role != Role.COURIER_UZ:
        raise AppError("COURIER_NOT_FOUND", "Kuryer topilmadi")
    return OkResponse(ok=True)


class LeaveRoleResponse(OkResponse):
    token: str
    user: UserOut


@router.post("/carrier/leave-role", response_model=LeaveRoleResponse)
async def leave_role(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(Role.CARRIER)),
) -> LeaveRoleResponse:
    """Yo'lovchi rolidan chiqish — faqat barcha yuklari WITH_CARRIER emas yoki DELIVERED_TR bo'lsa.
    Shartlar: hech qanday faol yuki qolmagan bo'lishi kerak (pending_admin, confirmed, with_courier_uz, with_carrier).
    """
    active_statuses = [
        ProductStatus.PENDING_ADMIN,
        ProductStatus.CONFIRMED,
        ProductStatus.WITH_COURIER_UZ,
        ProductStatus.WITH_CARRIER,
    ]
    # Yo'lovchining faol yuklar bormi
    active_count = await db.scalar(
        select(func.count())
        .select_from(Order)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .join(Product, Product.id == OrderItem.product_id)
        .where(
            Order.carrier_id == user.id,
            Product.status.in_(active_statuses),
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
