from pydantic import BaseModel

from app.core.enums import ProductStatus, ProductType


class ProductVariantOut(BaseModel):
    """Mahsulot o'lcham varianti. box_weight_kg carrier'ga null (firewall)."""

    id: int
    size_label: str
    quantity: int
    weight_kg: float
    tare_kg: float | None = None
    unit_weight_kg: float | None = None
    box_weight_kg: float | None = None
    box_count: int | None = None
    units_per_box: int | None = None
    cargo_price: int
    position: int


class ProductOut(BaseModel):
    """Kontrakt Product shakli. box_weight_kg carrier'ga null (firewall).
    quantity/weight_kg/cargo_price — variantlar yig'indisi/legacy."""

    id: int
    barcode: str
    name: str
    category: str
    type: ProductType
    quantity: int
    weight_kg: float
    tare_kg: float | None = None
    unit_weight_kg: float | None = None
    box_weight_kg: float | None = None
    box_count: int | None = None
    units_per_box: int | None = None
    cargo_price: int
    status: ProductStatus
    image_url: str | None = None
    variants: list[ProductVariantOut] = []
    # Toshkent omborida (WAREHOUSE_UZ) hozir qolgan jami miqdor.
    # None — hisoblanmagan (boshqa endpoint'lar). 0 — omborda qolmadi.
    in_warehouse_qty: int | None = None
