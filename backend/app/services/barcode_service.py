from datetime import date
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.barcode import format_barcode
from app.core.config import settings
from app.core.enums import ProductStatus, ProductType
from app.db.models import Product, ProductVariant
from app.services.counter_service import next_value


def build_print_url(barcode: str) -> str:
    """Kontrakt print_url: Word (.docx) yorliq linki (/api/v1/labels/<barcode>.docx)."""
    base = settings.label_base_url
    path = f"{settings.api_prefix}/labels/{barcode}.docx"
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
    created_by: int | None,
) -> Product:
    """1-qadam: faqat nom bilan mahsulot yaratadi (barkod + soni=0).

    Qolgan ma'lumotlar (tur, soni, vazn, narx) keyin apply_product_fields
    orqali to'ldiriladi (2-qadam yoki Tahrirlash).
    """
    barcode = await generate_barcode(db)
    product = Product(
        barcode=barcode,
        name=name,
        category=category,
        type=ProductType.PIECE,
        quantity=0,
        weight_kg=Decimal("0"),
        cargo_price=Decimal("0"),
        status=ProductStatus.IN_WAREHOUSE_UZ,
        received_date=date.today(),
        created_by=created_by,
    )
    db.add(product)
    await db.flush()
    return product


def apply_product_fields(
    product: Product,
    *,
    ptype: ProductType,
    quantity: int,
    weight_kg: float | None,
    tare_kg: float | None,
    unit_weight_kg: float | None,
    box_weight_kg: float | None,
    box_count: int | None,
    units_per_box: int | None,
    cargo_price: int,
    name: str | None = None,
    category: str | None = None,
) -> None:
    """Mavjud Product'ga tur/miqdor/vazn/narx ni qo'llaydi (2-qadam va Tahrirlash uchun).
    Barcha maydonlar ixtiyoriy — xodim qisman to'ldirishi mumkin.

    Turlar:
    - piece (donali): soni + umumiy vazn YOKI 1 dona vazni + tara + narx.
    - boxed (kiloli): soni (alohida) + quti soni + 1 qutidagi soni + 1 quti vazni + tara + narx.
    - textile: soni + umumiy vazn + tara.
    """
    total_weight = Decimal("0")
    unit_weight = _dec(unit_weight_kg)
    box_w = _dec(box_weight_kg)
    final_quantity = quantity

    if ptype == ProductType.PIECE:
        box_w = None
        box_count = None
        units_per_box = None
        if unit_weight is not None and quantity > 0:
            total_weight = unit_weight * Decimal(quantity)
        elif weight_kg is not None:
            total_weight = Decimal(str(weight_kg))
            if quantity > 0:
                unit_weight = total_weight / Decimal(quantity)
    elif ptype == ProductType.BOXED:
        # Soni endi alohida (xodim qo'lda kiritadi), avtomatik hisoblanmaydi
        if box_w is not None:
            total_weight = box_w * Decimal(box_count or 0)
        if final_quantity > 0 and total_weight > 0:
            unit_weight = total_weight / Decimal(final_quantity)
    else:  # TEXTILE (yoki eski WEIGHT)
        unit_weight = None
        box_w = None
        box_count = None
        units_per_box = None
        total_weight = Decimal(str(weight_kg)) if weight_kg is not None else Decimal("0")

    if name is not None:
        product.name = name
    if category is not None:
        product.category = category
    product.type = ptype
    product.quantity = final_quantity
    product.weight_kg = total_weight
    product.tare_kg = _dec(tare_kg)
    product.unit_weight_kg = unit_weight
    product.box_weight_kg = box_w
    product.box_count = box_count
    product.units_per_box = units_per_box
    product.cargo_price = Decimal(cargo_price)


def apply_variant_fields(
    variant: ProductVariant,
    *,
    ptype: ProductType,
    size_label: str,
    quantity: int,
    weight_kg: float | None,
    tare_kg: float | None,
    unit_weight_kg: float | None,
    box_weight_kg: float | None,
    box_count: int | None,
    units_per_box: int | None,
    cargo_price: int,
) -> None:
    """O'lcham variantiga miqdor/vazn/tara/narx ni qo'llaydi.
    Mantiq apply_product_fields bilan bir xil, lekin variant darajasida.
    Tur (ptype) Product darajasida — bu yerda faqat vazn hisoblash uchun ishlatiladi.
    """
    total_weight = Decimal("0")
    unit_weight = _dec(unit_weight_kg)
    box_w = _dec(box_weight_kg)

    if ptype == ProductType.PIECE:
        box_w = None
        box_count = None
        units_per_box = None
        if unit_weight is not None and quantity > 0:
            total_weight = unit_weight * Decimal(quantity)
        elif weight_kg is not None:
            total_weight = Decimal(str(weight_kg))
            if quantity > 0:
                unit_weight = total_weight / Decimal(quantity)
    elif ptype == ProductType.BOXED:
        if box_w is not None:
            total_weight = box_w * Decimal(box_count or 0)
        if quantity > 0 and total_weight > 0:
            unit_weight = total_weight / Decimal(quantity)
    else:  # TEXTILE
        unit_weight = None
        box_w = None
        box_count = None
        units_per_box = None
        total_weight = Decimal(str(weight_kg)) if weight_kg is not None else Decimal("0")

    variant.size_label = size_label
    variant.quantity = quantity
    variant.weight_kg = total_weight
    variant.tare_kg = _dec(tare_kg)
    variant.unit_weight_kg = unit_weight
    variant.box_weight_kg = box_w
    variant.box_count = box_count
    variant.units_per_box = units_per_box
    variant.cargo_price = Decimal(cargo_price)


def recompute_product_totals(product: Product) -> None:
    """Product yig'indi maydonlarini variantlardan qayta hisoblaydi.
    Eski skanlash/stats so'rovlari (product.quantity, weight_kg) shularga tayanadi.
    cargo_price/unit_weight_kg — birinchi variantdan (legacy ko'rsatuv)."""
    variants = product.variants
    product.quantity = sum(v.quantity for v in variants)
    product.weight_kg = sum((v.weight_kg or Decimal("0")) for v in variants) or Decimal("0")
    if variants:
        first = variants[0]
        product.cargo_price = first.cargo_price
        product.unit_weight_kg = first.unit_weight_kg
        product.box_weight_kg = first.box_weight_kg
        product.box_count = first.box_count
        product.units_per_box = first.units_per_box
        product.tare_kg = sum((v.tare_kg or Decimal("0")) for v in variants) or None
