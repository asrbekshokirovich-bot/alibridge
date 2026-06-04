"""Carrier debt model — yo'qotilgan/zararlangan yuk uchun qarzdorlik.

Yo'lovchi (carrier) yukni manzilga yetkaza olmasa yoki yo'qotsa, mahsulotning
intake'da kiritilgan `declared_value` qiymati asosida qarzdorlik yoziladi.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import ENUM, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.enums import DebtStatus
from app.infra.db.base import Base, UUIDPrimaryKeyMixin

debt_status_enum = ENUM(
    *[s.value for s in DebtStatus],
    name="debt_status_enum",
    create_type=False,
)


class CarrierDebt(Base, UUIDPrimaryKeyMixin):
    """Carrier akkauntidagi qarzdorlik yozuvi."""

    __tablename__ = "carrier_debts"
    __table_args__ = (
        Index("ix_carrier_debts_carrier", "carrier_user_id", "status"),
        Index("ix_carrier_debts_created_at", "created_at"),
    )

    carrier_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("carrier_profiles.user_id", ondelete="CASCADE"),
        nullable=False,
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True,
    )
    dispute_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("disputes.id", ondelete="SET NULL"),
        nullable=True,
    )

    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(
        debt_status_enum,
        nullable=False,
        default=DebtStatus.OUTSTANDING.value,
        server_default=DebtStatus.OUTSTANDING.value,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    settled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    settled_by_admin_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )

    def __repr__(self) -> str:
        return (
            f"<CarrierDebt id={self.id} carrier={self.carrier_user_id} "
            f"amount={self.amount} {self.currency} status={self.status}>"
        )
