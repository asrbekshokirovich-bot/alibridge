"""Carrier-related models: carrier_profiles, routes, carrier_picks."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ENUM, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.enums import (
    DisputeStatus,
    HandoffMode,
    HandoffStatus,
    OnboardingChannel,
    TrDeliveryMode,
    TrustTier,
)
from app.infra.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.infra.db.models.payout import PayoutLine
    from app.infra.db.models.product import Product
    from app.infra.db.models.user import User


# Enums
trust_enum = ENUM(*[t.value for t in TrustTier], name="trust_enum", create_type=False)
onboarding_enum = ENUM(
    *[o.value for o in OnboardingChannel],
    name="onboarding_enum",
    create_type=False,
)
handoff_mode_enum = ENUM(
    *[m.value for m in HandoffMode],
    name="handoff_mode_enum",
    create_type=False,
)
handoff_status_enum = ENUM(
    *[s.value for s in HandoffStatus],
    name="handoff_status_enum",
    create_type=False,
)
tr_delivery_enum = ENUM(
    *[m.value for m in TrDeliveryMode],
    name="tr_delivery_enum",
    create_type=False,
)
dispute_enum = ENUM(
    *[s.value for s in DisputeStatus],
    name="dispute_enum",
    create_type=False,
)


# ============================================
# Routes (UZ → TR allowed-kg matrix)
# ============================================
class Route(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Authoritative kg-limit per route + airline."""

    __tablename__ = "routes"
    __table_args__ = (
        UniqueConstraint(
            "depart_iata",
            "arrive_iata",
            "airline",
            name="uq_route_iata_airline",
        ),
        CheckConstraint("allowed_kg > 0", name="kg_positive"),
    )

    depart_iata: Mapped[str] = mapped_column(String(3), nullable=False)
    arrive_iata: Mapped[str] = mapped_column(String(3), nullable=False)
    airline: Mapped[str | None] = mapped_column(String(64), nullable=True)
    allowed_kg: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    def __repr__(self) -> str:
        return f"<Route {self.depart_iata}→{self.arrive_iata} {self.allowed_kg}kg>"


# ============================================
# Carrier profile
# ============================================
class CarrierProfile(Base, TimestampMixin):
    """Carrier identity + flight + trust + liability consent.

    Keyed by user_id (1:1 with users).
    """

    __tablename__ = "carrier_profiles"
    __table_args__ = (
        Index("ix_carrier_profiles_arrive_at", "arrive_at"),
        Index("ix_carrier_profiles_trust_tier", "trust_tier"),
        CheckConstraint("allowed_kg > 0", name="allowed_kg_positive"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # Personal info (entered by carrier during onboarding)
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    middle_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Identity (uploaded via mini-app; MRZ extraction is optional/future)
    passport_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    passport_country: Mapped[str | None] = mapped_column(String(3), nullable=True)
    passport_expires_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    passport_photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    selfie_photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Flight details
    ticket_photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    flight_number: Mapped[str | None] = mapped_column(String(16), nullable=True)
    depart_airport_iata: Mapped[str] = mapped_column(String(3), nullable=False)
    arrive_airport_iata: Mapped[str] = mapped_column(String(3), nullable=False)
    depart_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    arrive_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    allowed_kg: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)

    # Trust & liability
    trust_tier: Mapped[str] = mapped_column(
        trust_enum,
        nullable=False,
        default=TrustTier.NEW.value,
        server_default=TrustTier.NEW.value,
    )
    liability_consented_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    first_trip_value_cap: Mapped[Decimal | None] = mapped_column(
        Numeric(18, 4),
        nullable=True,
    )

    onboarding_channel: Mapped[str] = mapped_column(onboarding_enum, nullable=False)

    # Status flags
    selfie_reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    blacklisted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Reserved — kelajakdagi admin moderatsiyasi uchun (HOZIRCHA ISHLATILMAYDI).
    # Carrier tasdiqlash oqimi olib tashlandi: ro'yxatdan o'tgach darhol pick qiladi.
    # Ustunlar migration 0007 da yaratilgan — alembic tarixini buzmaslik uchun qoldirildi.
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    approved_by_admin_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )

    # Landing ping tracking
    landing_reported_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="carrier_profile")
    picks: Mapped[list["CarrierPick"]] = relationship(back_populates="carrier")

    def __repr__(self) -> str:
        return (
            f"<CarrierProfile user={self.user_id} "
            f"passport={self.passport_number} trust={self.trust_tier}>"
        )


# ============================================
# Carrier picks (basket items + locked price)
# ============================================
class CarrierPick(Base, UUIDPrimaryKeyMixin):
    """A carrier's claim on a specific product.

    UNIQUE(product_id) — one carrier per product (Invariant 1).

    `locked_cargo_price` is set at pick time and NEVER changes.
    Even if product.cargo_price_uz_to_tr is later edited,
    the carrier is paid the locked amount (Invariant 3).
    """

    __tablename__ = "carrier_picks"
    __table_args__ = (
        UniqueConstraint("product_id", name="uq_one_carrier_per_product"),
        Index("ix_carrier_picks_carrier_status", "carrier_user_id", "handoff_status"),
        Index("ix_carrier_picks_basket_lock", "basket_lock_until"),
        Index("ix_carrier_picks_payout_eligible_at", "payout_eligible_at"),
        CheckConstraint("locked_cargo_price >= 0", name="locked_price_non_negative"),
    )

    carrier_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("carrier_profiles.user_id", ondelete="RESTRICT"),
        nullable=False,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
    )

    # Locked at pick — Invariant 3
    locked_cargo_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    locked_currency: Mapped[str] = mapped_column(String(3), nullable=False)

    # Handoff
    handoff_mode: Mapped[str | None] = mapped_column(handoff_mode_enum, nullable=True)
    handoff_status: Mapped[str] = mapped_column(
        handoff_status_enum,
        nullable=False,
        default=HandoffStatus.IN_BASKET.value,
    )

    # UZ delivery
    delivery_address_uz: Mapped[str | None] = mapped_column(Text, nullable=True)
    delivery_window_start: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    delivery_window_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    yandex_order_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # TR delivery
    tr_delivery_mode: Mapped[str | None] = mapped_column(tr_delivery_enum, nullable=True)
    carrier_address_tr: Mapped[str | None] = mapped_column(Text, nullable=True)

    # WH approval — carrier savatni tasdiqlagach (AWAITING_HANDOFF), WH xodimi
    # tasdiqlaydi yoki rad etadi. wh_approved_at NULL = tasdiq kutilmoqda.
    wh_approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    wh_rejected_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Lifecycle
    picked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    basket_lock_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    payout_eligible_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    dispute_status: Mapped[str] = mapped_column(
        dispute_enum,
        nullable=False,
        default=DisputeStatus.NONE.value,
        server_default=DisputeStatus.NONE.value,
    )

    # Relationships
    carrier: Mapped["CarrierProfile"] = relationship(back_populates="picks")
    product: Mapped["Product"] = relationship(back_populates="carrier_pick")
    payout_lines: Mapped[list["PayoutLine"]] = relationship(back_populates="carrier_pick")

    def __repr__(self) -> str:
        return (
            f"<CarrierPick id={self.id} carrier={self.carrier_user_id} "
            f"product={self.product_id} status={self.handoff_status}>"
        )
