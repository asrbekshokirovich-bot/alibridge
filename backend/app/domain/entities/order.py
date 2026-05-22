"""Order entities."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.domain.enums import (
    FulfillmentStatus,
    OrderSource,
    OrderStatus,
    ValueTier,
)


class SourcingSpecEntity(BaseModel):
    """Item we can source ('what we sell')."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None = None
    category: str | None = None
    default_weight_g: int | None = None
    photos: list[Any] = Field(default_factory=list)
    is_urgent: bool = False
    is_customer_orderable: bool = False
    value_tier: ValueTier = ValueTier.REGULAR
    created_at: datetime


class OrderLineEntity(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    order_id: uuid.UUID
    sourcing_spec_id: uuid.UUID
    quantity: int = Field(..., gt=0)
    target_unit_weight_g: int | None = None
    color: str | None = None
    notes: str | None = None
    customer_paid_amount: Decimal | None = None
    customer_paid_currency: str | None = None
    count_received: int | None = None
    fulfillment_status: FulfillmentStatus
    has_quality_issue: bool = False
    created_at: datetime


class OrderEntity(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    orderer_user_id: uuid.UUID | None = None
    walk_in_customer_id: uuid.UUID | None = None
    source: OrderSource
    created_by_user_id: uuid.UUID
    status: OrderStatus
    notes: str | None = None
    created_at: datetime
    lines: list[OrderLineEntity] = Field(default_factory=list)
