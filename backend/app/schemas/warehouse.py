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
    """Tahrirlash: nom/kategoriya/tur (variantlardan mustaqil Product maydonlari).
    Eski miqdor/vazn maydonlari backward-compat uchun saqlanadi."""

    name: str | None = Field(default=None, max_length=256)
    category: str | None = Field(default=None, max_length=128)
    type: ProductType = ProductType.PIECE
    quantity: int = Field(default=0, ge=0)
    weight_kg: float | None = None
    tare_kg: float | None = None
    unit_weight_kg: float | None = None
    box_weight_kg: float | None = None
    box_count: int | None = None
    units_per_box: int | None = None
    cargo_price: int = Field(default=0, ge=0)


class AddVariantRequest(BaseModel):
    """Mahsulotga o'lcham varianti qo'shish/yangilash.
    Tur (type) Product darajasida — variantlar uchun bir xil.
    Barcha o'lchov maydonlari ixtiyoriy (xodim qisman to'ldiradi)."""

    type: ProductType = ProductType.PIECE
    size_label: str = Field(default="", max_length=64)
    quantity: int = Field(default=0, ge=0)
    weight_kg: float | None = None  # piece: 1 dona YOKI umumiy; textile: umumiy kg
    tare_kg: float | None = None  # qadoq/quti vazni (kg)
    unit_weight_kg: float | None = None  # piece: 1 dona vazni
    box_weight_kg: float | None = None  # boxed: 1 quti vazni
    box_count: int | None = None  # boxed: quti soni
    units_per_box: int | None = None  # boxed: 1 qutidagi soni
    cargo_price: int = Field(default=0, ge=0)  # piece: $/dona; boxed & textile: $/kg


# ─── Yo'lovchilar buyurtmalari (ombor tasdiqlash) ───────────────────────────────


class WarehouseOrderItemOut(BaseModel):
    item_id: int
    product_id: int
    variant_id: int | None = None
    size_label: str = ""
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
    handed_over: bool = False   # kuryerga topshirilganmi (qayta topshirishni bloklaydi)


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


class VariantAvailability(BaseModel):
    """Skan paytida manba egada shu variantdan nechta bor."""

    variant_id: int
    size_label: str
    available: int


class ScanResponse(BaseModel):
    barcode: str
    product_name: str
    carrier_name: str | None = None
    carrier_number: int | None = None
    quantity: int | None = None
    # Split custody: skan qilayotgan ega(manba)da har o'lchamdan nechta bor
    available_by_variant: list[VariantAvailability] = Field(default_factory=list)


class CustodyTransferItem(BaseModel):
    """Bitta o'tkazma: qaysi barkod, qaysi o'lcham, nechta dona."""

    barcode: str
    variant_id: int | None = None  # 1 ta variant bo'lsa avtomatik aniqlanadi
    quantity: int = Field(gt=0)


class ConfirmRequest(BaseModel):
    items: list[CustodyTransferItem] = Field(min_length=1, max_length=200)
    courier_id: int | None = None  # kuryerga topshirishda — qaysi kuryer


class CourierOption(BaseModel):
    id: int
    first_name: str
    last_name: str
    phone: str


class OrderHandoverRequest(BaseModel):
    """Buyurtmani tanlangan kuryerga topshirish."""

    courier_id: int


class HandoverOrderItem(BaseModel):
    """Buyurtmadagi bitta yuk — skan-checklist uchun (kutilayotgan + omborda bori)."""

    product_id: int
    variant_id: int | None = None
    barcode: str
    product_name: str
    size_label: str
    expected_qty: int       # buyurtmada so'ralgan (tasdiqlangan) miqdor
    in_warehouse_qty: int   # omborda hozir mavjud (split custody)


class HandoverOrderOut(BaseModel):
    """Kuryerga topshirishga tayyor buyurtma — yuklari skanlab tekshiriladi."""

    order_id: int
    carrier_name: str
    carrier_number: int | None = None
    pickup_type: PickupType
    items: list[HandoverOrderItem]
    total_to_handover: int   # sum(min(expected, in_warehouse)) — skanlanishi kerak bo'lgan jami


class HeldCargoItem(BaseModel):
    """Bir ega(holder)da turgan yuk: mahsulot + o'lcham + nechta dona."""

    product_id: int
    barcode: str
    product_name: str
    type: ProductType
    size_label: str
    quantity: int
    stage_label: str = ""  # yo'ldagi yuk qaysi bosqichda (jarayondagi ro'yxat uchun)
    holder_id: int = 0  # yo'ldagi yukni ushlab turgan ega (yo'lovchi/kuryer) user id
    holder_name: str = ""  # eganing ismi (jarayondagi ro'yxatda guruhlash uchun)
    holder_number: int | None = None  # yo'lovchi ALB raqami (carrier_number)
    delivery_address_tr: str = ""  # yo'lovchining Turkiyadagi yetkazish manzili
    holder_phone: str = ""  # eganing telefon raqami
    holder_username: str | None = None  # Telegram username (lichkaga o'tish uchun)
    holder_telegram_id: int | None = None  # Telegram id (username yo'q bo'lsa)
    flight_date: str | None = None  # parvoz sanasi (ISO)
    flight_number: str | None = None  # reys raqami


class StageQuantity(BaseModel):
    """Bir bosqichda (holder_type) jami nechta."""

    holder_type: str
    label: str
    quantity: int


class DailyOutItem(BaseModel):
    """Ombordan chiqqan bitta harakat (custody event)."""

    barcode: str
    product_name: str
    size_label: str
    quantity: int
    from_label: str  # qaysi ombordan
    to_label: str  # qayerga ketdi
    by_name: str  # kim skanladi
    time: str  # HH:MM


class DailyOutReport(BaseModel):
    """Bir kunlik ombordan chiqish hisoboti."""

    date: str
    total: int
    items: list[DailyOutItem]


class ProductDistribution(BaseModel):
    """Bir mahsulotning bosqichlar bo'ylab taqsimoti (split custody)."""

    product_id: int
    barcode: str
    product_name: str
    total: int
    stages: list[StageQuantity]


# ─── Walk-in (TR) ───────────────────────────────────────────────────────────────


class WalkInRequest(BaseModel):
    name: str = Field(min_length=1, max_length=256)
    phone: str = Field(default="", max_length=32)
    note: str = Field(default="", max_length=1000)
