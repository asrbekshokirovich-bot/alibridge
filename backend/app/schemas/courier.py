from pydantic import BaseModel, Field

from app.schemas.warehouse import CustodyTransferItem

# ─── Courier UZ ─────────────────────────────────────────────────────────────────


class CourierUzQueueProduct(BaseModel):
    barcode: str
    product_name: str
    size_label: str = ""
    picked_up: bool = False  # custody kuryerda — olib ketilgan


class CourierUzQueueItem(BaseModel):
    id: int
    carrier_name: str
    carrier_number: int | None = None
    address: str
    products_count: int
    status: str  # pending | in_progress | done
    products: list[CourierUzQueueProduct] = []
    confirmed_by_name: str | None = None  # buyurtmani olib ketgan kuryer ismi
    created_at: str = ""


class CourierUzMyProduct(BaseModel):
    """Kuryer hozir o'zida olib yurgan yuk (WITH_COURIER_UZ, custody kuryerda)."""

    product_id: int
    variant_id: int  # qaysi o'lcham — topshirishda kerak (split custody)
    barcode: str
    product_name: str
    category: str = ""
    image_url: str | None = None
    # qaysi yo'lovchining buyurtmasiga tegishli (buyurtmasiz bo'lsa null)
    carrier_name: str | None = None
    carrier_number: int | None = None
    picked_up_at: str = ""  # COURIER_UZ_PICKUP eventi sanasi
    size_label: str = ""
    quantity: int = 0  # kuryerda shu variantdan nechta


class ScanAirportRequest(BaseModel):
    barcode: str
    carrier_number: int


class ConfirmAirportRequest(BaseModel):
    carrier_number: int
    items: list[CustodyTransferItem] = Field(min_length=1, max_length=200)


# ─── Courier TR ─────────────────────────────────────────────────────────────────


class ReportDamagedRequest(BaseModel):
    carrier_number: int | None = None
    barcode: str
    note: str = Field(default="", max_length=1000)


class DeliveryItem(BaseModel):
    id: int
    address: str
    recipient_name: str
    products_count: int


class ScanDeliveryRequest(BaseModel):
    barcode: str
    delivery_id: int


class ConfirmDeliveryRequest(BaseModel):
    delivery_id: int
    items: list[CustodyTransferItem] = Field(min_length=1, max_length=200)
