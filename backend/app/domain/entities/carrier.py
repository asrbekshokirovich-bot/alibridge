"""Carrier entities."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.domain.enums import (
    DisputeStatus,
    HandoffMode,
    HandoffStatus,
    OnboardingChannel,
    TrDeliveryMode,
    TrustTier,
)


class RouteEntity(BaseModel):
    """Authoritative route + allowed kg."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    depart_iata: str = Field(..., min_length=3, max_length=3)
    arrive_iata: str = Field(..., min_length=3, max_length=3)
    airline: str | None = None
    allowed_kg: Decimal
    active: bool = True


class CarrierProfileEntity(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    passport_number: str
    passport_country: str
    passport_expires_on: date
    passport_photo_url: str | None = None
    selfie_photo_url: str | None = None
    ticket_photo_url: str | None = None
    flight_number: str | None = None
    depart_airport_iata: str
    arrive_airport_iata: str
    depart_at: datetime
    arrive_at: datetime
    allowed_kg: Decimal
    trust_tier: TrustTier = TrustTier.NEW
    liability_consented_at: datetime
    first_trip_value_cap: Decimal | None = None
    onboarding_channel: OnboardingChannel
    selfie_reviewed_at: datetime | None = None
    blacklisted_at: datetime | None = None
    landing_reported_at: datetime | None = None
    created_at: datetime


class CarrierPickEntity(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    carrier_user_id: uuid.UUID
    product_id: uuid.UUID
    locked_cargo_price: Decimal
    locked_currency: str
    handoff_mode: HandoffMode | None = None
    handoff_status: HandoffStatus
    delivery_address_uz: str | None = None
    delivery_window_start: datetime | None = None
    delivery_window_end: datetime | None = None
    yandex_order_id: str | None = None
    tr_delivery_mode: TrDeliveryMode | None = None
    carrier_address_tr: str | None = None
    picked_at: datetime
    basket_lock_until: datetime | None = None
    payout_eligible_at: datetime | None = None
    dispute_status: DisputeStatus = DisputeStatus.NONE
