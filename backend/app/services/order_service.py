from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.enums import OrderStatus, ProductStatus, ProductType
from app.core.errors import AppError
from app.db.models import Order, OrderItem, Product
from app.schemas.order import CreateOrderRequest


async def create_order(db: AsyncSession, carrier_id: int, body: CreateOrderRequest) -> Order:
    # Mahsulotlarni variantlari bilan bitta so'rovda olamiz
    product_ids = [it.product_id for it in body.items]
    rows = await db.execute(
        select(Product).where(Product.id.in_(product_ids)).options(selectinload(Product.variants))
    )
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
        # Variantni topamiz (berilgan bo'lsa). Narx variantdan qulflanadi.
        variant = None
        if it.variant_id is not None:
            variant = next((v for v in product.variants if v.id == it.variant_id), None)
            if variant is None:
                raise AppError("VARIANT_NOT_FOUND", "O'lcham topilmadi", status_code=404)
        locked_price = variant.cargo_price if variant else product.cargo_price
        db.add(
            OrderItem(
                order_id=order.id,
                product_id=product.id,
                variant_id=it.variant_id,
                amount=Decimal(str(it.amount)),
                # Narx qulflanadi — keyin o'zgarmaydi (invariant 4)
                locked_cargo_price=locked_price,
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
        .options(
            selectinload(Order.items).selectinload(OrderItem.product).selectinload(Product.variants),
            selectinload(Order.items).selectinload(OrderItem.variant),
        )
        .order_by(Order.created_at.desc())
    )
    return list(rows.scalars().all())


async def list_pending_orders_for_warehouse(db: AsyncSession) -> list[Order]:
    """Ombor ko'radigan buyurtmalar — tasdiqlash kutilayotgan (PENDING_ADMIN)
    va allaqachon tasdiqlangan (CONFIRMED) buyurtmalar.
    Tasdiqlangan buyurtma ro'yxatdan o'chmaydi — "Tasdiqlandi" bo'lib qoladi.
    Tartib: tasdiqlanmaganlar tepada, keyin sana bo'yicha (eng yangisi avval)."""
    rows = await db.execute(
        select(Order)
        .where(Order.status.in_([OrderStatus.PENDING_ADMIN, OrderStatus.CONFIRMED]))
        .options(
            selectinload(Order.items).selectinload(OrderItem.product).selectinload(Product.variants),
            selectinload(Order.items).selectinload(OrderItem.variant),
            selectinload(Order.carrier),
        )
        .order_by(
            (Order.status == OrderStatus.PENDING_ADMIN).desc(),
            Order.created_at.desc(),
        )
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
    by_weight = ProductType(product.type).priced_by_weight
    if by_weight and actual_kg is None:
        raise AppError("ACTUAL_KG_REQUIRED", "Kiloli yuk uchun kg kiritish shart")

    item.actual_quantity = actual_quantity
    item.actual_kg = actual_kg if by_weight else None
    product.status = ProductStatus.CONFIRMED

    order_confirmed = all(it.actual_quantity is not None for it in order.items)
    if order_confirmed:
        order.status = OrderStatus.CONFIRMED

    await db.flush()
    return item, product, order.carrier_id, order_confirmed
