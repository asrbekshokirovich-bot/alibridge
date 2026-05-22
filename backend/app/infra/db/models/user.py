"""User-related models: users, user_roles, walk_in_customers."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ENUM, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.enums import Language, Role
from app.infra.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.infra.db.models.carrier import CarrierProfile
    from app.infra.db.models.order import Order


# PostgreSQL native enum types — created once, reused everywhere
role_enum = ENUM(
    *[r.value for r in Role],
    name="role_enum",
    create_type=False,  # created in migration
)

language_enum = ENUM(
    *[l.value for l in Language],
    name="language_enum",
    create_type=False,
)


# ============================================
# Users
# ============================================
class User(Base, UUIDPrimaryKeyMixin):
    """Telegram-authenticated user.

    One Telegram account = one user. Roles are additive via user_roles.
    """

    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_telegram_id", "telegram_id", unique=True),
        Index("ix_users_phone", "phone"),
        Index("ix_users_last_seen_at", "last_seen_at"),
    )

    telegram_id: Mapped[int] = mapped_column(
        BigInteger,
        unique=True,
        nullable=False,
    )
    telegram_username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    phone_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    language_code: Mapped[str] = mapped_column(
        language_enum,
        nullable=False,
        default=Language.EN.value,
        server_default=Language.EN.value,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    last_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    roles: Mapped[list["UserRole"]] = relationship(
        "UserRole",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
        foreign_keys="UserRole.user_id",
    )
    carrier_profile: Mapped["CarrierProfile | None"] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
    orders: Mapped[list["Order"]] = relationship(
        back_populates="orderer",
        foreign_keys="Order.orderer_user_id",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} tg={self.telegram_id} name={self.full_name!r}>"


# ============================================
# User roles (additive)
# ============================================
class UserRole(Base):
    """One user can have multiple roles.

    Example: same person can be both `admin` AND `warehouse_tr`.
    """

    __tablename__ = "user_roles"
    __table_args__ = (
        UniqueConstraint("user_id", "role", name="uq_user_role"),
        Index("ix_user_roles_role", "role"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role: Mapped[str] = mapped_column(role_enum, primary_key=True)

    granted_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        back_populates="roles",
        foreign_keys=[user_id],
    )


# ============================================
# Walk-in customers (no Telegram)
# ============================================
class WalkInCustomer(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Customers without Telegram. Captured by TR warehouse worker.

    Phone is the contact channel for pickup notifications.
    """

    __tablename__ = "walk_in_customers"
    __table_args__ = (
        Index("ix_walk_in_customers_phone", "phone"),
        CheckConstraint("length(phone) >= 7", name="phone_min_length"),
    )

    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    id_document_last4: Mapped[str | None] = mapped_column(String(4), nullable=True)

    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Relationships
    orders: Mapped[list["Order"]] = relationship(
        back_populates="walk_in_customer",
    )

    def __repr__(self) -> str:
        return f"<WalkInCustomer id={self.id} name={self.full_name!r} phone={self.phone}>"
