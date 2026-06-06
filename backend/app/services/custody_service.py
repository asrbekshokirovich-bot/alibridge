from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import (
    CustodyEventType,
    HolderType,
    ProductStatus,
)
from app.core.errors import AppError
from app.db.models import CustodyEvent, Product


async def get_product_by_barcode(db: AsyncSession, barcode: str) -> Product:
    product = await db.scalar(select(Product).where(Product.barcode == barcode))
    if product is None:
        raise AppError("BARCODE_NOT_FOUND", "Barkod topilmadi", status_code=400)
    return product


async def transfer_custody(
    db: AsyncSession,
    product: Product,
    *,
    to_holder_type: HolderType | None,
    to_holder_id: int | None,
    event_type: CustodyEventType,
    scanned_by: int | None,
    new_status: ProductStatus | None = None,
) -> CustodyEvent:
    """Yuk egaligini o'tkazadi: custody_events ga yozadi + denormalizatsiyani yangilaydi.

    custody_events APPEND ONLY (invariant 2).
    """
    event = CustodyEvent(
        product_id=product.id,
        from_holder_type=product.custody_holder_type,
        from_holder_id=product.custody_holder_id,
        to_holder_type=to_holder_type,
        to_holder_id=to_holder_id,
        event_type=event_type,
        scanned_by=scanned_by,
    )
    db.add(event)

    # Denormalizatsiya
    product.custody_holder_type = to_holder_type
    product.custody_holder_id = to_holder_id
    if new_status is not None:
        product.status = new_status

    await db.flush()
    return event
