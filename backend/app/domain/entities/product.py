"""Product entity."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.domain.enums import HolderType, ProductCondition, ProductStatus


class ProductEntity(BaseModel):
    """One physical unit. The product passport."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    short_code: str = Field(..., max_length=8)
    order_line_id: uuid.UUID | None = None
    sourcing_spec_id: uuid.UUID

    unit_weight_g: int = Field(..., gt=0)
    color: str | None = None
    intake_photo_url: str | None = None

    cargo_price_uz_to_tr: Decimal
    cargo_currency: str = "UZS"

    declared_value: Decimal | None = None
    declared_currency: str = "USD"
    box_items_count: int | None = None

    condition_on_intake: ProductCondition = ProductCondition.OK
    status: ProductStatus
    custody_holder_type: HolderType
    custody_holder_id: uuid.UUID | None = None

    qr_payload: str
    barcode_payload: str

    label_printed_at: datetime | None = None
    label_attached_at: datetime | None = None
    created_at: datetime
    flagged_lost: bool = False
