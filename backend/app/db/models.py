from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import (
    CustodyEventType,
    DisputeStatus,
    HolderType,
    OrderStatus,
    PaymentStatus,
    PickupType,
    ProductStatus,
    ProductType,
    Role,
    StaffRequestStatus,
)
from app.db.base import Base


def _now() -> datetime:
    return datetime.utcnow()


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    first_name: Mapped[str] = mapped_column(String(128))
    last_name: Mapped[str] = mapped_column(String(128), default="")
    phone: Mapped[str] = mapped_column(String(32), default="")
    passport: Mapped[str | None] = mapped_column(String(256), nullable=True)
    role: Mapped[Role] = mapped_column(String(32), default=Role.NEW, index=True)
    carrier_number: Mapped[int | None] = mapped_column(Integer, unique=True, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    orders: Mapped[list[Order]] = relationship(back_populates="carrier")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    barcode: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(256))
    category: Mapped[str] = mapped_column(String(128), default="")
    type: Mapped[ProductType] = mapped_column(String(16), default=ProductType.PIECE)
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    weight_kg: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0"))
    unit_weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    box_weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    # kiloli (boxed): quti soni va 1 quti ichidagi mahsulot soni
    box_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    units_per_box: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cargo_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0"))
    status: Mapped[ProductStatus] = mapped_column(
        String(32), default=ProductStatus.IN_WAREHOUSE_UZ, index=True
    )
    received_date: Mapped[date] = mapped_column(Date, default=date.today)
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Denormalizatsiya: yuk hozir kimda (custody_events asosida yangilanadi)
    custody_holder_type: Mapped[HolderType | None] = mapped_column(String(32), nullable=True)
    custody_holder_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    carrier_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    pickup_type: Mapped[PickupType] = mapped_column(String(16), default=PickupType.SELF)
    pickup_address: Mapped[str | None] = mapped_column(String(512), nullable=True)
    delivery_address_tr: Mapped[str] = mapped_column(String(512), default="")
    flight_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[OrderStatus] = mapped_column(
        String(32), default=OrderStatus.PENDING_ADMIN, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    carrier: Mapped[User] = relationship(back_populates="orders")
    items: Mapped[list[OrderItem]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    # donali: dona soni; kiloli: kg
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0"))
    # kiloli tortilgach aniqlangan dona soni
    actual_quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # kiloli uchun haqiqiy tortilgan kg (faqat ko'rsatuv; to'lov actual_quantity ga tayanadi)
    actual_kg: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    # narx qulflanadi — order_item yaratilganda nusxalanadi
    locked_cargo_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0"))

    order: Mapped[Order] = relationship(back_populates="items")
    product: Mapped[Product] = relationship()


class Dispute(Base):
    __tablename__ = "disputes"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"), nullable=True)
    carrier_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reported_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    barcode: Mapped[str] = mapped_column(String(32), default="")
    note: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[DisputeStatus] = mapped_column(
        String(16), default=DisputeStatus.OPEN, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    carrier_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    products_count: Mapped[int] = mapped_column(Integer, default=0)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0"))
    status: Mapped[PaymentStatus] = mapped_column(
        String(16), default=PaymentStatus.UNPAID, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class WalkInCustomer(Base):
    __tablename__ = "walk_in_customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(256))
    phone: Mapped[str] = mapped_column(String(32), default="")
    note: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class StaffRequest(Base):
    __tablename__ = "staff_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[StaffRequestStatus] = mapped_column(
        String(16), default=StaffRequestStatus.PENDING, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    user: Mapped[User] = relationship()


class CustodyEvent(Base):
    """APPEND ONLY — faqat INSERT. UPDATE/DELETE trigger orqali taqiqlanadi."""

    __tablename__ = "custody_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    from_holder_type: Mapped[HolderType | None] = mapped_column(String(32), nullable=True)
    from_holder_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    to_holder_type: Mapped[HolderType | None] = mapped_column(String(32), nullable=True)
    to_holder_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    event_type: Mapped[CustodyEventType] = mapped_column(String(32))
    scanned_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Counter(Base):
    """Ketma-ket raqamlar (barcode ALB-NNNNNN, carrier_number) uchun atomik hisoblagich."""

    __tablename__ = "counters"

    name: Mapped[str] = mapped_column(String(32), primary_key=True)
    value: Mapped[int] = mapped_column(Integer, default=0)


__all__ = [
    "User",
    "Product",
    "Order",
    "OrderItem",
    "Dispute",
    "Payment",
    "WalkInCustomer",
    "StaffRequest",
    "CustodyEvent",
    "Counter",
]
