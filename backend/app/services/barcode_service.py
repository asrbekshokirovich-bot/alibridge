from datetime import date
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.barcode import format_barcode
from app.core.config import settings
from app.core.enums import ProductStatus, ProductType
from app.db.models import Product
from app.services.counter_service import next_value


def build_print_url(barcode: str) -> str:
    """Kontrakt print_url: PDF yorliq linki (/api/v1/labels/<barcode>.pdf)."""
    base = settings.label_base_url
    path = f"{settings.api_prefix}/labels/{barcode}.pdf"
    return f"{base}{path}" if base else path


async def generate_barcode(db: AsyncSession) -> str:
    num = await next_value(db, "barcode")
    return format_barcode(num)


async def create_received_product(
    db: AsyncSession,
    *,
    name: str,
    category: str,
    ptype: ProductType,
    quantity: int,
    weight_kg: float | None,
    box_weight_kg: float | None,
    cargo_price: int,
    created_by: int | None,
) -> Product:
    """Xitoydan kelgan yukni qabul qiladi — barkod generatsiya + Product yaratadi."""
    barcode = await generate_barcode(db)

    # Donali uchun unit_weight: agar weight_kg berilgan bo'lsa hisoblaymiz
    unit_weight = None
    total_weight = Decimal(str(weight_kg)) if weight_kg is not None else Decimal("0")
    if ptype == ProductType.PIECE and weight_kg and quantity > 0:
        unit_weight = Decimal(str(weight_kg)) / Decimal(quantity)

    product = Product(
        barcode=barcode,
        name=name,
        category=category,
        type=ptype,
        quantity=quantity,
        weight_kg=total_weight,
        unit_weight_kg=unit_weight,
        box_weight_kg=Decimal(str(box_weight_kg)) if box_weight_kg is not None else None,
        cargo_price=Decimal(cargo_price),
        status=ProductStatus.IN_WAREHOUSE_UZ,
        received_date=date.today(),
        created_by=created_by,
    )
    db.add(product)
    await db.flush()
    return product
