from pydantic import BaseModel, Field

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


class ScanAirportRequest(BaseModel):
    barcode: str
    carrier_number: int


class ConfirmAirportRequest(BaseModel):
    carrier_number: int
    barcodes: list[str] = Field(min_length=1, max_length=200)


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
    barcodes: list[str] = Field(min_length=1, max_length=200)
