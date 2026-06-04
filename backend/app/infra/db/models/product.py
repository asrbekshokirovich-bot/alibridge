"""Product model — the "product passport" (one row per physical unit).

Created at Tashkent intake. Each product has a unique QR + barcode.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

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
from sqlalchemy.dialects.postgresql import ENUM, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.enums import HolderType, ProductCondition, ProductStatus
from app.infra.db.base import Base, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.infra.db.models.carrier import CarrierPick
    from app.infra.db.models.custody import CustodyEvent
    from app.infra.db.models.order import OrderLine, SourcingSpec


# Enums
product_status_enum = ENUM(
    *[s.value for s in ProductStatus],
    name="product_status_enum",
    create_type=False,
)
holder_type_enum = ENUM(
    *[h.value for h in HolderType],
    name="holder_type_enum",
    create_type=False,
)
condition_enum = ENUM(
    *[c.value for c in ProductCondition],
    name="condition_enum",
    create_type=False,
)


# ============================================
# Product
# ============================================
class Product(Base, UUIDPrimaryKeyMixin):
    """One row per physical unit. The product passport.

    Created at Tashkent intake. order_line_id is nullable because:
    - Orderer cancels after creation → product becomes "unallocated inventory"
    - Overage at intake → extras start as unallocated
    """

    __tablename__ = "products"
    __table_args__ = (
        # Hot-path catalog query: status + holder
        Index(
            "ix_products_status_holder",
            "status",
            "custody_holder_type",
            "custody_holder_id",
        ),
        # Catalog filtering: available items by spec
        Index(
            "ix_products_at_tashkent_by_spec",
            "sourcing_spec_id",
            "status",
            postgresql_where="status = 'at_tashkent_wh'",
        ),
        Index("ix_products_short_code", "short_code", unique=True),
        Index("ix_products_order_line_id", "order_line_id"),
        Index("ix_products_created_at", "created_at"),
        CheckConstraint("unit_weight_g > 0", name="weight_positive"),
        CheckConstraint("cargo_price_uz_to_tr >= 0", name="price_non_negative"),
    )

    # Identifiers
    short_code: Mapped[str] = mapped_column(String(8), unique=True, nullable=False)
    order_line_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("order_lines.id", ondelete="SET NULL"),
        nullable=True,
    )
    sourcing_spec_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sourcing_specs.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Physical attributes
    unit_weight_g: Mapped[int] = mapped_column(Integer, nullable=False)
    color: Mapped[str | None] = mapped_column(String(64), nullable=True)
    intake_photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Pricing (locked in carrier_picks at pick time — Invariant 3)
    cargo_price_uz_to_tr: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    cargo_currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="UZS",
        server_default="UZS",
    )

    # Declared goods value — yo'qotish/zarar holatida carrier qarzdorligi shu summa
    declared_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    declared_currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="USD",
        server_default="USD",
    )

    # Quti (box) rejimi: ichidagi dona soni. NULL = oddiy dona-mahsulot.
    box_items_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Tara (quti/qadoq) vazni, gramm. Tekstil rejimida kiritiladi. NULL = tarasiz.
    # Faqat admin / UZ skladchi / TR ombor ko'radi (carrier/orderer KO'RMAYDI).
    tare_weight_g: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Condition at intake
    condition_on_intake: Mapped[str] = mapped_column(
        condition_enum,
        nullable=False,
        default=ProductCondition.OK.value,
        server_default=ProductCondition.OK.value,
    )

    # Lifecycle status
    status: Mapped[str] = mapped_column(
        product_status_enum,
        nullable=False,
        default=ProductStatus.PENDING_INTAKE.value,
    )

    # Current holder (denormalized for fast catalog queries)
    # Authoritative source: custody_events table
    custody_holder_type: Mapped[str] = mapped_column(
        holder_type_enum,
        nullable=False,
        default=HolderType.TASHKENT_WH.value,
    )
    custody_holder_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,  # null for warehouse singletons
    )

    # QR & barcode
    qr_payload: Mapped[str] = mapped_column(Text, nullable=False)
    barcode_payload: Mapped[str] = mapped_column(String(64), nullable=False)

    # Label printing tracking (B5 — printer jam recovery)
    label_printed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    label_attached_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Metadata
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    flagged_lost: Mapped[bool] = mapped_column(default=False, server_default="false")

    # Relationships
    order_line: Mapped["OrderLine | None"] = relationship(back_populates="products")
    sourcing_spec: Mapped["SourcingSpec"] = relationship(back_populates="products")
    custody_events: Mapped[list["CustodyEvent"]] = relationship(
        back_populates="product",
        order_by="CustodyEvent.at",
    )
    carrier_pick: Mapped["CarrierPick | None"] = relationship(
        back_populates="product",
        uselist=False,
    )

    def __repr__(self) -> str:
        return (
            f"<Product id={self.id} code={self.short_code} "
            f"status={self.status} holder={self.custody_holder_type}>"
        )
