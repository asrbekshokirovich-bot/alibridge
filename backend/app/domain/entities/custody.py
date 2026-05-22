"""Custody event entity."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.domain.enums import CustodyEventType, HolderType


class CustodyEventEntity(BaseModel):
    """Single transition in the custody ledger.

    Append-only — never updated or deleted.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: uuid.UUID
    event_type: CustodyEventType
    from_holder_type: HolderType | None = None
    from_holder_id: uuid.UUID | None = None
    to_holder_type: HolderType
    to_holder_id: uuid.UUID | None = None
    actor_user_id: uuid.UUID
    session_id: uuid.UUID | None = None
    seal_number: str | None = None
    handoff_code: str | None = None
    photo_url: str | None = None
    geo_lat: Decimal | None = None
    geo_lng: Decimal | None = None
    notes: str | None = None
    at: datetime
