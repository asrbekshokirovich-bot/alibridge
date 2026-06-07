from pydantic import BaseModel, Field

from app.core.enums import OrderStatus, PickupType, ProductType
from app.schemas.product import ProductOut


class OrderItemIn(BaseModel):
    product_id: int
    # donali: dona soni; kiloli: kg
    amount: float = Field(gt=0)


class CreateOrderRequest(BaseModel):
    items: list[OrderItemIn] = Field(min_length=1, max_length=200)
    pickup_type: PickupType
    pickup_address: str | None = Field(default=None, max_length=512)
    delivery_address_tr: str = Field(min_length=1, max_length=512)


class OrderItemOut(BaseModel):
    product_id: int
    product_name: str
    type: ProductType
    amount: float  # so'ralgan dona/kg
    actual_quantity: int | None = None
    actual_kg: float | None = None
    confirmed: bool


class CarrierOrderOut(BaseModel):
    id: int
    carrier_id: int
    products: list[ProductOut]
    items: list[OrderItemOut] = []
    pickup_type: PickupType
    pickup_address: str | None = None
    delivery_address_tr: str
    status: OrderStatus
    created_at: str


class CourierBrief(BaseModel):
    id: int
    first_name: str
    last_name: str


class AutoReceiveRequest(BaseModel):
    courier_id: int
