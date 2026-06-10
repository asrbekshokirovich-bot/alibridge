from pydantic import BaseModel, Field

from app.core.enums import DisputeStatus, PaymentStatus, Role


class AdminStats(BaseModel):
    pending_staff: int
    active_carriers: int
    total_products: int
    open_disputes: int
    unpaid_payments: int


class StaffRequestOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    phone: str
    created_at: str


class ApproveStaffRequest(BaseModel):
    role: Role  # warehouse_uz | warehouse_tr | courier_uz | courier_tr | china_worker


class CarrierOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    phone: str
    carrier_number: int | None = None
    is_active: bool
    total_trips: int
    has_cargo: bool = False  # hozir yo'lovchida yuk bormi


class StaffMemberOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    phone: str
    role: Role
    is_active: bool
    username: str | None = None  # sayt login (o'rnatilgan bo'lsa)


class SetCredentialsRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=4, max_length=128)


class DisputeOut(BaseModel):
    id: int
    product_name: str
    barcode: str
    carrier_name: str
    carrier_number: int | None = None
    note: str
    status: DisputeStatus
    created_at: str


class UpdateDisputeRequest(BaseModel):
    status: DisputeStatus  # resolved | rejected


class PaymentOut(BaseModel):
    id: int
    carrier_name: str
    carrier_number: int | None = None
    products_count: int
    total_amount: int
    status: PaymentStatus
