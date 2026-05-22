"""Payout models: payouts + payout_lines (per-pick granularity)."""

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
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ENUM, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.enums import PayoutMethod, PayoutStatus
from app.infra.db.base import Base, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.infra.db.models.carrier import CarrierPick


# Enums
payout_method_enum = ENUM(
    *[m.value for m in PayoutMethod],
    name="payout_method_enum",
    create_type=False,
)
payout_status_enum = ENUM(
    *[s.value for s in PayoutStatus],
    name="payout_status_enum",
    create_type=False,
)


# ============================================
# Payout (one request)
# ============================================
class Payout(Base, UUIDPrimaryKeyMixin):
    """A single payout request from a carrier.

    May cover N picks (per-pick eligibility allows partial payouts).
    FX rate is locked at request time.
    """

    __tablename__ = "payouts"
    __table_args__ = (
        Index("ix_payouts_carrier_status", "carrier_user_id", "status"),
        Index("ix_payouts_requested_at", "requested_at"),
        CheckConstraint("amount >= 0", name="amount_non_negative"),
    )

    carrier_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("carrier_profiles.user_id", ondelete="RESTRICT"),
        nullable=False,
    )

    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    method: Mapped[str] = mapped_column(payout_method_enum, nullable=False)

    # FX rate locked at request time (G2)
    fx_rate: Mapped[Decimal | None] = mapped_column(Numeric(18, 8), nullable=True)
    fx_base_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)

    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    paid_by_admin_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        payout_status_enum,
        nullable=False,
        default=PayoutStatus.REQUESTED.value,
        server_default=PayoutStatus.REQUESTED.value,
    )

    # External reference (bank tx, crypto hash, etc.)
    payment_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    lines: Mapped[list["PayoutLine"]] = relationship(
        back_populates="payout",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<Payout id={self.id} carrier={self.carrier_user_id} "
            f"{self.amount} {self.currency} status={self.status}>"
        )


# ============================================
# Payout line (per-pick breakdown)
# ============================================
class PayoutLine(Base, UUIDPrimaryKeyMixin):
    """One line per carrier_pick covered by a payout.

    Deductions for lost/damaged items are recorded here with reason.
    """

    __tablename__ = "payout_lines"
    __table_args__ = (
        Index("ix_payout_lines_payout_id", "payout_id"),
        Index("ix_payout_lines_carrier_pick_id", "carrier_pick_id"),
        CheckConstraint("amount >= 0", name="line_amount_non_negative"),
        CheckConstraint("deduction >= 0", name="deduction_non_negative"),
    )

    payout_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payouts.id", ondelete="CASCADE"),
        nullable=False,
    )
    carrier_pick_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("carrier_picks.id", ondelete="RESTRICT"),
        nullable=False,
    )

    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    deduction: Mapped[Decimal] = mapped_column(
        Numeric(18, 4),
        nullable=False,
        default=Decimal("0"),
        server_default="0",
    )
    deduction_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    payout: Mapped["Payout"] = relationship(back_populates="lines")
    carrier_pick: Mapped["CarrierPick"] = relationship(back_populates="payout_lines")

    def __repr__(self) -> str:
        return (
            f"<PayoutLine payout={self.payout_id} pick={self.carrier_pick_id} "
            f"amount={self.amount} deduction={self.deduction}>"
        )
