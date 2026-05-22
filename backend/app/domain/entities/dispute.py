"""Dispute entity."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.domain.enums import DisputeResolution, DisputeType


class DisputeEntity(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: uuid.UUID
    type: DisputeType
    raised_by_user_id: uuid.UUID
    raised_at: datetime
    evidence_urls: list[Any] = Field(default_factory=list)
    custody_event_id_at_dispute: uuid.UUID | None = None
    resolution: DisputeResolution | None = None
    resolved_by_admin_id: uuid.UUID | None = None
    resolved_at: datetime | None = None
    resolution_notes: str | None = None
