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


def _dec(value: float | int | None) -> Decimal | None:
    return Decimal(str(value)) if value is not None else None


async def create_received_product(
    db: AsyncSession,
    *,
    name: str,
    category: str,
    ptype: ProductType,
    quantity: int,
    weight_kg: float | None,
    unit_weight_kg: float | None,
    box_weight_kg: float | None,
    box_count: int | None,
    units_per_box: int | None,
    cargo_price: int,
    created_by: int | None,
) -> Product:
    """Xitoydan kelgan yukni qabul qiladi — barkod generatsiya + Product yaratadi.

    Turlar:
    - piece (donali): quantity + vazn. Xodim 1 dona vaznini (unit_weight_kg) YOKI
      umumiy vaznni (weight_kg) kiritadi; biridan ikkinchisi hisoblanadi.
    - boxed (kiloli): box_count × units_per_box = jami dona; box_count × box_weight_kg = jami kg.
    - textile: quantity + umumiy weight_kg.
    """
    barcode = await generate_barcode(db)

    total_weight = Decimal("0")
    unit_weight = _dec(unit_weight_kg)
    box_w = _dec(box_weight_kg)
    final_quantity = quantity

    if ptype == ProductType.PIECE:
        # 1 dona vazni yoki umumiy vazn — biridan ikkinchisini chiqaramiz
        if unit_weight is not None and quantity > 0:
            total_weight = unit_weight * Decimal(quantity)
        elif weight_kg is not None:
            total_weight = Decimal(str(weight_kg))
            if quantity > 0:
                unit_weight = total_weight / Decimal(quantity)
    elif ptype == ProductType.BOXED:
        # quti soni × 1 quti ichidagi soni = jami dona; quti soni × 1 quti kg = jami kg
        bc = box_count or 0
        upb = units_per_box or 0
        final_quantity = bc * upb
        if box_w is not None:
            total_weight = box_w * Decimal(bc)
        if final_quantity > 0 and total_weight > 0:
            unit_weight = total_weight / Decimal(final_quantity)
    else:  # TEXTILE (yoki eski WEIGHT)
        total_weight = Decimal(str(weight_kg)) if weight_kg is not None else Decimal("0")

    product = Product(
        barcode=barcode,
        name=name,
        category=category,
        type=ptype,
        quantity=final_quantity,
        weight_kg=total_weight,
        unit_weight_kg=unit_weight,
        box_weight_kg=box_w,
        box_count=box_count,
        units_per_box=units_per_box,
        cargo_price=Decimal(cargo_price),
        status=ProductStatus.IN_WAREHOUSE_UZ,
        received_date=date.today(),
        created_by=created_by,
    )
    db.add(product)
    await db.flush()
    return product
