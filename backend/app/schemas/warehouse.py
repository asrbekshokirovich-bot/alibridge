from pydantic import BaseModel, Field

from app.core.enums import OrderStatus, PickupType, ProductType

# ─── Warehouse UZ ───────────────────────────────────────────────────────────────


class WarehouseUzStats(BaseModel):
    pending_receive: int
    in_warehouse: int
    pending_handover: int
    pending_orders: int = 0


class ReceiveGoodsRequest(BaseModel):
    """1-qadam: faqat nom (+ixtiyoriy kategoriya) — barkod yaratiladi.
    Qolgan ma'lumotlar keyin PATCH /products/{id} orqali to'ldiriladi."""

    name: str = Field(min_length=1, max_length=256)
    category: str = Field(default="", max_length=128)


class ReceiveGoodsResponse(BaseModel):
    id: int
    barcode: str
    name: str
    received_date: str
    print_url: str
    quantity: int


class UpdateProductRequest(BaseModel):
    """2-qadam (to'ldirish) yoki Tahrirlash: tur + miqdor + vazn + narx."""

    name: str | None = Field(default=None, max_length=256)
    category: str | None = Field(default=None, max_length=128)
    type: ProductType
    quantity: int = Field(default=0, ge=0)
    weight_kg: float | None = None  # piece: 1 dona YOKI umumiy; textile: umumiy kg
    unit_weight_kg: float | None = None  # piece: agar xodim to'g'ridan 1 dona vaznini kiritsa
    box_weight_kg: float | None = None  # boxed: 1 quti vazni (kg)
    box_count: int | None = None  # boxed: quti soni
    units_per_box: int | None = None  # boxed: 1 quti ichidagi mahsulot soni
    cargo_price: int = Field(ge=0)  # piece: $/dona; boxed & textile: $/kg


# ─── Yo'lovchilar buyurtmalari (ombor tasdiqlash) ───────────────────────────────


class WarehouseOrderItemOut(BaseModel):
    item_id: int
    product_id: int
    barcode: str
    product_name: str
    category: str
    type: ProductType  # piece | weight
    requested_amount: float  # OrderItem.amount (so'ralgan dona/kg)
    actual_quantity: int | None = None
    actual_kg: float | None = None  # tekstil: tortilgan kg
    confirmed: bool
    cargo_price: int


class WarehouseOrderOut(BaseModel):
    order_id: int
    carrier_name: str
    carrier_number: int | None = None
    pickup_type: PickupType
    pickup_address: str | None = None
    delivery_address_tr: str
    status: OrderStatus
    created_at: str
    items: list[WarehouseOrderItemOut]
    all_confirmed: bool


class ConfirmOrderItemRequest(BaseModel):
    actual_quantity: int = Field(gt=0)
    actual_kg: float | None = Field(default=None, gt=0)  # kiloli uchun shart


class ConfirmOrderItemResponse(BaseModel):
    item_id: int
    order_id: int
    actual_quantity: int
    actual_kg: float | None = None
    barcode: str
    print_url: str
    order_confirmed: bool


# ─── Scan / Confirm (umumiy) ────────────────────────────────────────────────────


class ScanRequest(BaseModel):
    barcode: str


class ScanResponse(BaseModel):
    barcode: str
    product_name: str
    carrier_name: str | None = None
    carrier_number: int | None = None
    quantity: int | None = None


class ConfirmRequest(BaseModel):
    barcodes: list[str] = Field(min_length=1, max_length=200)


# ─── Walk-in (TR) ───────────────────────────────────────────────────────────────


class WalkInRequest(BaseModel):
    name: str = Field(min_length=1, max_length=256)
    phone: str = Field(default="", max_length=32)
    note: str = Field(default="", max_length=1000)
