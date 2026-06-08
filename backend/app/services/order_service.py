from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.enums import OrderStatus, ProductStatus
from app.core.errors import AppError
from app.db.models import Order, OrderItem, Product
from app.schemas.order import CreateOrderRequest


async def create_order(db: AsyncSession, carrier_id: int, body: CreateOrderRequest) -> Order:
    # Mahsulotlarni bitta so'rovda olamiz
    product_ids = [it.product_id for it in body.items]
    rows = await db.execute(select(Product).where(Product.id.in_(product_ids)))
    products = {p.id: p for p in rows.scalars().all()}

    missing = [pid for pid in product_ids if pid not in products]
    if missing:
        raise AppError(
            "PRODUCT_NOT_FOUND",
            "Ba'zi mahsulotlar topilmadi",
            details={"product_ids": missing},
        )

    order = Order(
        carrier_id=carrier_id,
        pickup_type=body.pickup_type,
        pickup_address=body.pickup_address,
        delivery_address_tr=body.delivery_address_tr,
        flight_date=body.flight_date,
        status=OrderStatus.PENDING_ADMIN,
    )
    db.add(order)
    await db.flush()

    for it in body.items:
        product = products[it.product_id]
        # order.items.append o'rniga to'g'ridan-to'g'ri qo'shamiz — lazy-load'dan qochish
        db.add(
            OrderItem(
                order_id=order.id,
                product_id=product.id,
                amount=Decimal(str(it.amount)),
                # Narx qulflanadi — keyin o'zgarmaydi (invariant 4)
                locked_cargo_price=product.cargo_price,
            )
        )
        # Mahsulot statusini "admin tasdig'i kutilmoqda" ga o'tkazamiz
        product.status = ProductStatus.PENDING_ADMIN

    await db.flush()
    return order


async def list_carrier_orders(db: AsyncSession, carrier_id: int) -> list[Order]:
    rows = await db.execute(
        select(Order)
        .where(Order.carrier_id == carrier_id)
        .options(selectinload(Order.items).selectinload(OrderItem.product))
        .order_by(Order.created_at.desc())
    )
    return list(rows.scalars().all())


async def list_pending_orders_for_warehouse(db: AsyncSession) -> list[Order]:
    """Ombor ko'radigan buyurtmalar — admin tasdig'isiz, PENDING_ADMIN holatda.
    FIFO: eng eski buyurtma birinchi."""
    rows = await db.execute(
        select(Order)
        .where(Order.status == OrderStatus.PENDING_ADMIN)
        .options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.carrier),
        )
        .order_by(Order.created_at.asc())
    )
    return list(rows.scalars().all())


async def confirm_order_item(
    db: AsyncSession,
    *,
    order_id: int,
    item_id: int,
    actual_quantity: int,
    actual_kg: Decimal | None,
    confirmed_by: int,
) -> tuple[OrderItem, Product, int, bool]:
    """Ombor xodimi buyurtmaning bitta mahsulotini tasdiqlaydi.

    Tekstil: actual_kg + actual_quantity. Donali: actual_quantity.
    Barcha itemlar tasdiqlangach buyurtma CONFIRMED bo'ladi.
    Qaytaradi: (item, product, carrier_id, order_confirmed)
    """
    order = await db.scalar(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items).selectinload(OrderItem.product))
    )
    if order is None:
        raise AppError("ORDER_NOT_FOUND", "Buyurtma topilmadi", status_code=404)
    if order.status != OrderStatus.PENDING_ADMIN:
        raise AppError("ORDER_NOT_PENDING", "Buyurtma allaqachon tasdiqlangan")

    item = next((it for it in order.items if it.id == item_id), None)
    if item is None:
        raise AppError("ITEM_NOT_FOUND", "Mahsulot buyurtmada topilmadi", status_code=404)

    product = item.product
    if product.type.priced_by_weight and actual_kg is None:
        raise AppError("ACTUAL_KG_REQUIRED", "Kiloli yuk uchun kg kiritish shart")

    item.actual_quantity = actual_quantity
    item.actual_kg = actual_kg if product.type.priced_by_weight else None
    product.status = ProductStatus.CONFIRMED

    order_confirmed = all(it.actual_quantity is not None for it in order.items)
    if order_confirmed:
        order.status = OrderStatus.CONFIRMED

    await db.flush()
    return item, product, order.carrier_id, order_confirmed
