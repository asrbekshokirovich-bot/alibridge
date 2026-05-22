"""Dispute model — issues raised against a carrier_pick."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ENUM, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.enums import DisputeType
from app.infra.db.base import Base, UUIDPrimaryKeyMixin


# Enums
dispute_type_enum = ENUM(
    *[t.value for t in DisputeType],
    name="dispute_type_enum",
    create_type=False,
)


class Dispute(Base, UUIDPrimaryKeyMixin):
    """A dispute raised against a product/pick.

    Types: LOST, DAMAGED, WRONG_ITEM, NOT_RECEIVED.
    Admin resolves: DEDUCT, WRITE_OFF, REORDER, REFUND_ORDERER.
    """

    __tablename__ = "disputes"
    __table_args__ = (
        Index("ix_disputes_product_id", "product_id"),
        Index("ix_disputes_raised_at", "raised_at"),
        Index(
            "ix_disputes_unresolved",
            "raised_at",
            postgresql_where="resolved_at IS NULL",
        ),
    )

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
    )

    type: Mapped[str] = mapped_column(dispute_type_enum, nullable=False)

    raised_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    raised_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Evidence (photo URLs, screenshots, etc.)
    evidence_urls: Mapped[list[Any]] = mapped_column(
        JSONB,
        default=list,
        server_default="[]",
        nullable=False,
    )

    # Snapshot of where the product was when dispute was raised
    custody_event_id_at_dispute: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("custody_events.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Resolution (stored as text — frontend uses CARRIER_FAULT/FORCE_MAJEURE/ORDERER_FAULT/SPLIT)
    resolution: Mapped[str | None] = mapped_column(String(50), nullable=True)
    resolved_by_admin_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return (
            f"<Dispute id={self.id} product={self.product_id} "
            f"type={self.type} resolved={self.resolved_at is not None}>"
        )
