"""Payout entities."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.domain.enums import PayoutMethod, PayoutStatus


class PayoutLineEntity(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    payout_id: uuid.UUID
    carrier_pick_id: uuid.UUID
    amount: Decimal
    deduction: Decimal = Field(default=Decimal("0"))
    deduction_reason: str | None = None


class PayoutEntity(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    carrier_user_id: uuid.UUID
    amount: Decimal
    currency: str
    method: PayoutMethod
    fx_rate: Decimal | None = None
    fx_base_currency: str | None = None
    requested_at: datetime
    approved_at: datetime | None = None
    paid_at: datetime | None = None
    paid_by_admin_id: uuid.UUID | None = None
    status: PayoutStatus
    payment_reference: str | None = None
    notes: str | None = None
    lines: list[PayoutLineEntity] = Field(default_factory=list)
