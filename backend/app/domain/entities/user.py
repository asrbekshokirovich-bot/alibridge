"""User entities."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.domain.enums import Language, Role


class UserEntity(BaseModel):
    """Telegram user."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    telegram_id: int
    telegram_username: str | None = None
    phone: str | None = None
    phone_verified_at: datetime | None = None
    full_name: str | None = None
    language_code: Language = Language.EN
    created_at: datetime
    last_seen_at: datetime | None = None


class UserRoleEntity(BaseModel):
    """User → Role grant."""

    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    role: Role
    granted_by_user_id: uuid.UUID | None = None
    granted_at: datetime
    revoked_at: datetime | None = None


class WalkInCustomerEntity(BaseModel):
    """Customer without Telegram."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    phone: str = Field(..., min_length=7, max_length=20)
    id_document_last4: str | None = None
    created_by_user_id: uuid.UUID
    created_at: datetime
    notes: str | None = None
