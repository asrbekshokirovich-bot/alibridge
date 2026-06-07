from decimal import Decimal

from app.db.models import Product
from app.schemas.product import ProductOut


def _to_int(value: Decimal | int | None) -> int:
    if value is None:
        return 0
    return int(round(float(value)))


def _to_float(value: Decimal | float | None) -> float | None:
    if value is None:
        return None
    return float(value)


def product_to_out(p: Product, *, expose_box_weight: bool = False) -> ProductOut:
    """Product ORM -> kontrakt ProductOut.

    expose_box_weight=False (default) — carrier firewall: box_weight_kg null.
    warehouse_tr uchun True (ko'ra oladi).
    """
    return ProductOut(
        id=p.id,
        barcode=p.barcode,
        name=p.name,
        category=p.category,
        type=p.type,
        quantity=p.quantity,
        weight_kg=round(_to_float(p.weight_kg) or 0.0, 2),
        unit_weight_kg=_to_float(p.unit_weight_kg),
        box_weight_kg=_to_float(p.box_weight_kg) if expose_box_weight else None,
        cargo_price=_to_int(p.cargo_price),
        status=p.status,
        image_url=p.image_url,
    )
