from pydantic import BaseModel

from app.core.enums import ProductStatus, ProductType


class ProductOut(BaseModel):
    """Kontrakt Product shakli. box_weight_kg carrier'ga null (firewall)."""

    id: int
    barcode: str
    name: str
    category: str
    type: ProductType
    quantity: int
    weight_kg: float
    unit_weight_kg: float | None = None
    box_weight_kg: float | None = None
    box_count: int | None = None
    units_per_box: int | None = None
    cargo_price: int
    status: ProductStatus
    image_url: str | None = None
