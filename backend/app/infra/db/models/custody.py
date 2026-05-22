"""Custody events — APPEND-ONLY ledger.

This is the single source of truth for who holds what.
The `products.custody_holder_*` columns are a denormalized cache.

CRITICAL: Postgres role permissions enforce INSERT + SELECT only.
UPDATE and DELETE are revoked at the DB level — NOT just in app code.

Reference: DEV_PLAN_V2 §3 Invariant 1, §4.4
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
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

from app.domain.enums import CustodyEventType, HolderType
from app.infra.db.base import Base, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.infra.db.models.product import Product


# Enums
event_type_enum = ENUM(
    *[e.value for e in CustodyEventType],
    name="event_type_enum",
    create_type=False,
)


class CustodyEvent(Base, UUIDPrimaryKeyMixin):
    """One row per custody transition.

    APPEND-ONLY: this table NEVER gets UPDATE or DELETE.
    To "undo" an event, write a compensating event.

    Each scan during a session writes ITS OWN row — Invariant 4.
    session_id is for grouping in UI, NOT for atomicity.
    """

    __tablename__ = "custody_events"
    __table_args__ = (
        # Single-product history (most common query)
        Index("ix_custody_events_product_at", "product_id", "at"),
        # Worker activity feed
        Index("ix_custody_events_actor_at", "actor_user_id", "at"),
        # Session grouping (for UI replay)
        Index("ix_custody_events_session_id", "session_id"),
        # Event type queries (e.g., all DELIVERED_TO_ORDERER for payouts)
        Index("ix_custody_events_event_type", "event_type"),
    )

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
    )

    event_type: Mapped[str] = mapped_column(event_type_enum, nullable=False)

    # Transition
    from_holder_type: Mapped[str | None] = mapped_column(
        ENUM(
            *[h.value for h in HolderType],
            name="holder_type_enum",
            create_type=False,
        ),
        nullable=True,  # null on initial creation
    )
    from_holder_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    to_holder_type: Mapped[str] = mapped_column(
        ENUM(
            *[h.value for h in HolderType],
            name="holder_type_enum",
            create_type=False,
        ),
        nullable=False,
    )
    to_holder_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # Who performed the scan/action
    actor_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Session — for UI multi-scan grouping (NOT a database transaction)
    session_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # Optional verification artifacts
    seal_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    handoff_code: Mapped[str | None] = mapped_column(String(16), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    geo_lat: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    geo_lng: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)

    # Free-form notes (for admin overrides)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    product: Mapped["Product"] = relationship(back_populates="custody_events")

    def __repr__(self) -> str:
        return (
            f"<CustodyEvent id={self.id} product={self.product_id} "
            f"{self.from_holder_type} → {self.to_holder_type} "
            f"event={self.event_type} at={self.at}>"
        )
