"""Orders endpoint."""

from __future__ import annotations

import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps.auth import get_current_user
from app.api.deps.db import get_db_session
from app.core.exceptions import AppException
from app.domain.entities.order import OrderEntity
from app.domain.enums import OrderStatus, Role
from app.infra.db.models.custody import CustodyEvent  # noqa: F401 — needed for selectinload
from app.infra.db.models.order import Order, OrderLine
from app.infra.db.models.product import Product
from app.infra.db.models.user import User
from app.repositories.user_repo import UserRepository
from app.services.create_order import CreateOrderService, OrderLineInput

# Statuses considered "in transit" for the orderer dashboard
_IN_TRANSIT = {
    OrderStatus.PENDING_SOURCING, OrderStatus.SOURCING,
    OrderStatus.IN_TRANSIT_CN_UZ, OrderStatus.AT_TASHKENT,
    OrderStatus.IN_TRANSIT_UZ_TR, OrderStatus.AT_TR_WH,
    OrderStatus.PARTIALLY_DELIVERED,
}

router = APIRouter()


class OrderLineCreate(BaseModel):
    sourcing_spec_id: uuid.UUID
    quantity: int = Field(..., gt=0)
    target_unit_weight_g: int | None = None
    color: str | None = None
    notes: str | None = None
    customer_paid_amount: Decimal | None = None
    customer_paid_currency: str | None = None


class CreateOrderRequest(BaseModel):
    walk_in_customer_id: uuid.UUID | None = None
    lines: list[OrderLineCreate]
    notes: str | None = None


@router.get("/summary")
async def order_summary(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Orderer dashboard uchun qisqacha statistika."""
    rows = (await session.execute(
        select(Order.status, func.count(Order.id))
        .where(Order.orderer_user_id == user.id)
        .group_by(Order.status)
    )).all()
    counts: dict[str, int] = {r[0]: r[1] for r in rows}
    total = sum(counts.values())
    in_transit = sum(counts.get(s.value, 0) for s in _IN_TRANSIT)
    delivered = counts.get(OrderStatus.DELIVERED.value, 0)
    return {"total": total, "in_transit": in_transit, "delivered": delivered}


@router.get("")
async def list_my_orders(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Mening buyurtmalarim."""
    result = await session.execute(
        select(Order)
        .options(selectinload(Order.lines))
        .where(Order.orderer_user_id == user.id)
        .order_by(Order.created_at.desc())
    )
    orders = list(result.scalars().all())
    return [
        {
            "id": str(o.id),
            "order_number": str(o.id)[:8].upper(),
            "status": o.status,
            "total_items": sum(l.quantity for l in (o.lines or [])),
            "created_at": o.created_at.isoformat(),
            "destination_city": o.notes or "",
            "wh_uz_approved_at": o.wh_uz_approved_at.isoformat() if o.wh_uz_approved_at else None,
        }
        for o in orders
    ]


@router.post("", response_model=OrderEntity, status_code=201)
async def create_order(
    body: CreateOrderRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> OrderEntity:
    """Yangi buyurtma yaratish."""
    service = CreateOrderService(session)

    lines = [
        OrderLineInput(
            sourcing_spec_id=line.sourcing_spec_id,
            quantity=line.quantity,
            target_unit_weight_g=line.target_unit_weight_g,
            color=line.color,
            notes=line.notes,
            customer_paid_amount=line.customer_paid_amount,
            customer_paid_currency=line.customer_paid_currency,
        )
        for line in body.lines
    ]

    # CRIT-5 fix: walk-in customer tekshiruvi
    if body.walk_in_customer_id is not None:
        user_roles = await UserRepository(session).get_roles(user.id)
        if Role.WAREHOUSE_UZ not in user_roles:
            raise AppException(
                message="Walk-in buyurtma faqat ombor xodimi yaratishi mumkin",
                error_code="forbidden",
                status_code=403,
            )
        # IDOR fix: berilgan UUID haqiqiy foydalanuvchi ekanligini tekshirish
        walk_in_user = await UserRepository(session).get_by_id(body.walk_in_customer_id)
        if walk_in_user is None:
            raise AppException(
                message="Bunday foydalanuvchi topilmadi",
                error_code="not_found",
                status_code=404,
            )

    order = await service.create(
        created_by_user_id=user.id,
        lines=lines,
        orderer_user_id=user.id if body.walk_in_customer_id is None else None,
        walk_in_customer_id=body.walk_in_customer_id,
        notes=body.notes,
    )

    # Lines bilan birga qaytarish
    result = await session.execute(
        select(Order).options(selectinload(Order.lines)).where(Order.id == order.id)
    )
    order_with_lines = result.scalar_one()
    return OrderEntity.model_validate(order_with_lines)


class SimpleOrderLine(BaseModel):
    name: str
    quantity: int = Field(..., gt=0)
    unit_weight_g: int = 0
    notes: str | None = None


class CreateSimpleOrderRequest(BaseModel):
    destination_city: str = ""
    lines: list[SimpleOrderLine]
    notes: str | None = None


@router.post("/simple", status_code=201)
async def create_simple_order(
    body: CreateSimpleOrderRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Buyurtmachi uchun soddalashtirilgan buyurtma yaratish.

    Har bir qator uchun avtomatik SourcingSpec yaratiladi.
    destination_city → order.notes da saqlanadi.
    """
    from app.infra.db.models.order import SourcingSpec as SourcingSpecModel

    valid_lines = [l for l in body.lines if l.name.strip()]
    if not valid_lines:
        raise HTTPException(status_code=400, detail="Kamida 1 ta mahsulot nomi kerak")

    # Har bir qator uchun SourcingSpec yaratish
    spec_pairs: list[tuple[uuid.UUID, SimpleOrderLine]] = []
    for line in valid_lines:
        spec = SourcingSpecModel(
            id=uuid.uuid4(),
            title=line.name.strip(),
            default_weight_g=line.unit_weight_g if line.unit_weight_g > 0 else None,
            is_customer_orderable=False,  # carrier katalogida ko'rinmasin
        )
        session.add(spec)
        await session.flush()
        spec_pairs.append((spec.id, line))

    combined_notes = body.destination_city.strip() or None
    if body.notes and body.notes.strip():
        combined_notes = (
            f"{combined_notes}\n{body.notes.strip()}" if combined_notes else body.notes.strip()
        )

    service = CreateOrderService(session)
    order = await service.create(
        created_by_user_id=user.id,
        lines=[
            OrderLineInput(
                sourcing_spec_id=spec_id,
                quantity=line.quantity,
                target_unit_weight_g=line.unit_weight_g if line.unit_weight_g > 0 else None,
                notes=line.notes,
            )
            for spec_id, line in spec_pairs
        ],
        orderer_user_id=user.id,
        notes=combined_notes,
    )
    await session.commit()

    return {"id": str(order.id), "order_number": str(order.id)[:8].upper()}


@router.get("/{order_id}")
async def get_order_detail(
    order_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Buyurtma tafsilotlari va mahsulotlar kuzatuvi."""
    try:
        oid = uuid.UUID(order_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Buyurtma topilmadi")

    result = await session.execute(
        select(Order)
        .options(
            selectinload(Order.lines).selectinload(OrderLine.sourcing_spec),
            selectinload(Order.lines).selectinload(OrderLine.products)
                .selectinload(Product.custody_events),
            selectinload(Order.lines).selectinload(OrderLine.products)
                .selectinload(Product.sourcing_spec),
        )
        .where(Order.id == oid)
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Buyurtma topilmadi")
    if order.orderer_user_id != user.id:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q")

    lines_data = []
    products_data = []

    for line in order.lines:
        spec_title = line.sourcing_spec.title if line.sourcing_spec else "Noma'lum"
        lines_data.append({
            "id": str(line.id),
            "spec_title": spec_title,
            "quantity": line.quantity,
            "count_received": line.count_received or 0,
        })
        for product in line.products:
            products_data.append({
                "short_code": product.short_code,
                "spec_title": product.sourcing_spec.title if product.sourcing_spec else spec_title,
                "status": product.status,
                "custody_events": [
                    {
                        "event_type": e.event_type,
                        "holder_type": e.to_holder_type,
                        "created_at": e.at.isoformat(),
                    }
                    for e in product.custody_events
                ],
            })

    return {
        "id": str(order.id),
        "order_number": str(order.id)[:8].upper(),
        "status": order.status,
        "destination_city": order.notes or "",
        "created_at": order.created_at.isoformat(),
        "lines": lines_data,
        "products": products_data,
    }
