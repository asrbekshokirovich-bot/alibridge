"""Order-related models: sourcing_specs, orders, order_lines."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ENUM, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.enums import (
    FulfillmentStatus,
    OrderSource,
    OrderStatus,
    ValueTier,
)
from app.infra.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.infra.db.models.product import Product
    from app.infra.db.models.user import User, WalkInCustomer


# Enums
order_source_enum = ENUM(*[s.value for s in OrderSource], name="order_source_enum", create_type=False)
order_status_enum = ENUM(*[s.value for s in OrderStatus], name="order_status_enum", create_type=False)
fulfillment_enum = ENUM(*[s.value for s in FulfillmentStatus], name="fulfillment_enum", create_type=False)
value_tier_enum = ENUM(*[t.value for t in ValueTier], name="value_tier_enum", create_type=False)


# ============================================
# Sourcing specs (shared catalog of "what we can buy")
# ============================================
class SourcingSpec(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """The shared catalog of items we can source.

    One spec → many order_lines → many products.
    Admin curates customer-orderable specs.
    """

    __tablename__ = "sourcing_specs"
    __table_args__ = (
        Index("ix_sourcing_specs_category", "category"),
        Index("ix_sourcing_specs_is_urgent", "is_urgent"),
        Index(
            "ix_sourcing_specs_title_trgm",
            "title",
            postgresql_using="gin",
            postgresql_ops={"title": "gin_trgm_ops"},
        ),
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(64), nullable=True)
    default_weight_g: Mapped[int | None] = mapped_column(Integer, nullable=True)

    photos: Mapped[list[Any]] = mapped_column(JSONB, default=list, server_default="[]")

    is_urgent: Mapped[bool] = mapped_column(default=False, server_default="false")
    is_customer_orderable: Mapped[bool] = mapped_column(default=False, server_default="false")
    value_tier: Mapped[str] = mapped_column(
        value_tier_enum,
        default=ValueTier.REGULAR.value,
        server_default=ValueTier.REGULAR.value,
        nullable=False,
    )

    # Relationships
    order_lines: Mapped[list["OrderLine"]] = relationship(back_populates="sourcing_spec")
    products: Mapped[list["Product"]] = relationship(back_populates="sourcing_spec")

    def __repr__(self) -> str:
        return f"<SourcingSpec id={self.id} title={self.title!r}>"


# ============================================
# Orders
# ============================================
class Order(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """An order placed by an orderer (via bot) or by warehouse for walk-in.

    Exactly one of `orderer_user_id` or `walk_in_customer_id` must be set.
    """

    __tablename__ = "orders"
    __table_args__ = (
        # Exactly one of orderer / walk-in must be set
        CheckConstraint(
            "(orderer_user_id IS NOT NULL) <> (walk_in_customer_id IS NOT NULL)",
            name="orderer_xor_walkin",
        ),
        Index("ix_orders_orderer_user_id", "orderer_user_id"),
        Index("ix_orders_walk_in_customer_id", "walk_in_customer_id"),
        Index("ix_orders_status", "status"),
        Index("ix_orders_created_at", "created_at"),
    )

    orderer_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )
    walk_in_customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("walk_in_customers.id", ondelete="RESTRICT"),
        nullable=True,
    )

    source: Mapped[str] = mapped_column(order_source_enum, nullable=False)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Status is DERIVED, recomputed on every line event
    status: Mapped[str] = mapped_column(
        order_status_enum,
        nullable=False,
        default=OrderStatus.DRAFT.value,
        server_default=OrderStatus.DRAFT.value,
    )

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    orderer: Mapped["User | None"] = relationship(
        back_populates="orders",
        foreign_keys=[orderer_user_id],
    )
    walk_in_customer: Mapped["WalkInCustomer | None"] = relationship(
        back_populates="orders",
        foreign_keys=[walk_in_customer_id],
    )
    lines: Mapped[list["OrderLine"]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Order id={self.id} status={self.status}>"


# ============================================
# Order lines
# ============================================
class OrderLine(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A line item in an order — N units of a sourcing spec.

    `count_received` and `fulfillment_status` are set at intake to handle
    overage (received > ordered), shortage (received < ordered),
    and wrong-spec arrivals.
    """

    __tablename__ = "order_lines"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="quantity_positive"),
        CheckConstraint(
            "count_received IS NULL OR count_received >= 0",
            name="count_received_non_negative",
        ),
        Index("ix_order_lines_order_id", "order_id"),
        Index("ix_order_lines_sourcing_spec_id", "sourcing_spec_id"),
        Index("ix_order_lines_fulfillment_status", "fulfillment_status"),
    )

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    sourcing_spec_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sourcing_specs.id", ondelete="RESTRICT"),
        nullable=False,
    )

    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    target_unit_weight_g: Mapped[int | None] = mapped_column(Integer, nullable=True)
    color: Mapped[str | None] = mapped_column(String(64), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    customer_paid_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(18, 4),
        nullable=True,
    )
    customer_paid_currency: Mapped[str | None] = mapped_column(
        String(3),
        nullable=True,
    )

    count_received: Mapped[int | None] = mapped_column(Integer, nullable=True)

    fulfillment_status: Mapped[str] = mapped_column(
        fulfillment_enum,
        nullable=False,
        default=FulfillmentStatus.PENDING_SOURCING.value,
        server_default=FulfillmentStatus.PENDING_SOURCING.value,
    )

    has_quality_issue: Mapped[bool] = mapped_column(default=False, server_default="false")

    # Relationships
    order: Mapped["Order"] = relationship(back_populates="lines")
    sourcing_spec: Mapped["SourcingSpec"] = relationship(back_populates="order_lines")
    products: Mapped[list["Product"]] = relationship(back_populates="order_line")

    def __repr__(self) -> str:
        return (
            f"<OrderLine id={self.id} order={self.order_id} "
            f"qty={self.quantity} status={self.fulfillment_status}>"
        )
