from decimal import Decimal

from app.db.models import Product, ProductVariant
from app.schemas.product import ProductOut, ProductVariantOut


def _to_int(value: Decimal | int | None) -> int:
    if value is None:
        return 0
    return int(round(float(value)))


def _to_float(value: Decimal | float | None) -> float | None:
    if value is None:
        return None
    return float(value)


def variant_to_out(v: ProductVariant, *, expose_box_weight: bool = False) -> ProductVariantOut:
    """ProductVariant ORM -> ProductVariantOut. Firewall variant darajasida."""
    return ProductVariantOut(
        id=v.id,
        size_label=v.size_label,
        quantity=v.quantity,
        weight_kg=round(_to_float(v.weight_kg) or 0.0, 2),
        tare_kg=_to_float(v.tare_kg),
        unit_weight_kg=_to_float(v.unit_weight_kg),
        box_weight_kg=_to_float(v.box_weight_kg) if expose_box_weight else None,
        box_count=v.box_count,
        units_per_box=v.units_per_box,
        cargo_price=_to_int(v.cargo_price),
        position=v.position,
    )


def product_to_out(p: Product, *, expose_box_weight: bool = False) -> ProductOut:
    """Product ORM -> kontrakt ProductOut.

    expose_box_weight=False (default) — carrier firewall: box_weight_kg null.
    warehouse_tr uchun True (ko'ra oladi).
    quantity/weight_kg/cargo_price — legacy/yig'indi (Product ustunlaridan).
    """
    return ProductOut(
        id=p.id,
        barcode=p.barcode,
        name=p.name,
        category=p.category,
        type=p.type,
        quantity=p.quantity,
        weight_kg=round(_to_float(p.weight_kg) or 0.0, 2),
        tare_kg=_to_float(p.tare_kg),
        unit_weight_kg=_to_float(p.unit_weight_kg),
        box_weight_kg=_to_float(p.box_weight_kg) if expose_box_weight else None,
        box_count=p.box_count,
        units_per_box=p.units_per_box,
        cargo_price=_to_int(p.cargo_price),
        status=p.status,
        image_url=p.image_url,
        variants=[variant_to_out(v, expose_box_weight=expose_box_weight) for v in p.variants],
    )
