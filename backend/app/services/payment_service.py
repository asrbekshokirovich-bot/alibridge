from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import PaymentStatus, ProductStatus
from app.db.models import Order, OrderItem, Payment, Product


async def recompute_carrier_payment(db: AsyncSession, carrier_id: int) -> Payment | None:
    """Yo'lovchi yetkazgan yuklar bo'yicha to'lovni qayta hisoblaydi.

    Faqat delivered_tr statusdagi mahsulotlar hisobga olinadi.
    locked_cargo_price * amount (yoki actual_quantity kiloli uchun).
    """
    rows = await db.execute(
        select(OrderItem, Product)
        .join(Order, Order.id == OrderItem.order_id)
        .join(Product, Product.id == OrderItem.product_id)
        .where(
            Order.carrier_id == carrier_id,
            Product.status == ProductStatus.DELIVERED_TR,
        )
    )
    total = Decimal("0")
    count = 0
    for item, product in rows.all():
        qty = item.actual_quantity if item.actual_quantity is not None else item.amount
        total += item.locked_cargo_price * Decimal(str(qty))
        count += 1

    if count == 0:
        return None

    # Mavjud unpaid to'lovni yangilaymiz yoki yangi yaratamiz
    payment = await db.scalar(
        select(Payment).where(
            Payment.carrier_id == carrier_id, Payment.status == PaymentStatus.UNPAID
        )
    )
    if payment is None:
        payment = Payment(carrier_id=carrier_id, status=PaymentStatus.UNPAID)
        db.add(payment)

    payment.products_count = count
    payment.total_amount = total
    await db.flush()
    return payment
