"""User repository."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.domain.enums import Role
from app.infra.db.models.user import User, UserRole, WalkInCustomer
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    model = User

    async def get_by_telegram_id(self, telegram_id: int) -> User | None:
        """Telegram ID bo'yicha topish (auth uchun)."""
        result = await self.session.execute(
            select(User)
            .options(selectinload(User.roles))
            .where(User.telegram_id == telegram_id)
        )
        return result.scalar_one_or_none()

    async def get_roles(self, user_id: uuid.UUID) -> list[Role]:
        """Foydalanuvchining aktiv rollarini olish."""
        result = await self.session.execute(
            select(UserRole.role)
            .where(UserRole.user_id == user_id)
            .where(UserRole.revoked_at.is_(None))
        )
        return [Role(r) for r in result.scalars().all()]

    async def grant_role(
        self,
        *,
        user_id: uuid.UUID,
        role: Role,
        granted_by_user_id: uuid.UUID,
    ) -> UserRole:
        """Foydalanuvchiga rol berish (avval berilgan bo'lsa — qayta tiklash)."""
        # Upsert: agar rol avval berilgan (yoki bekor qilingan) bo'lsa — yangilash
        result = await self.session.execute(
            select(UserRole)
            .where(UserRole.user_id == user_id)
            .where(UserRole.role == role.value)
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.revoked_at = None
            existing.granted_by_user_id = granted_by_user_id
            await self.session.flush()
            return existing

        ur = UserRole(
            user_id=user_id,
            role=role.value,
            granted_by_user_id=granted_by_user_id,
        )
        self.session.add(ur)
        await self.session.flush()
        return ur

    async def revoke_role(self, *, user_id: uuid.UUID, role: str) -> bool:
        """Foydalanuvchidan rolni olib tashlash (soft-delete: revoked_at = now)."""
        result = await self.session.execute(
            select(UserRole)
            .where(UserRole.user_id == user_id)
            .where(UserRole.role == role)
            .where(UserRole.revoked_at.is_(None))
        )
        ur = result.scalar_one_or_none()
        if not ur:
            return False
        ur.revoked_at = datetime.now(timezone.utc)
        await self.session.flush()
        return True

    async def list_users(self, search: str = "", limit: int = 50) -> list[User]:
        """Foydalanuvchilar ro'yxati (ixtiyoriy qidiruv bilan)."""
        q = select(User).options(selectinload(User.roles))
        if search:
            pattern = f"%{search}%"
            q = q.where(
                or_(
                    User.full_name.ilike(pattern),
                    User.telegram_username.ilike(pattern),
                )
            )
        q = q.order_by(User.created_at.desc()).limit(limit)
        result = await self.session.execute(q)
        return list(result.scalars().all())

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        """ID bo'yicha topish."""
        result = await self.session.execute(
            select(User).options(selectinload(User.roles)).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def update_phone(self, user_id: uuid.UUID, phone: str) -> None:
        """Telefon raqamini yangilash."""
        user = await self.session.get(User, user_id)
        if user:
            user.phone = phone
            await self.session.flush()

    async def upsert_telegram_user(
        self,
        *,
        telegram_id: int,
        full_name: str | None,
        telegram_username: str | None,
        language_code: str,
    ) -> User:
        """Telegram'dan kelgan ma'lumot bo'yicha userni yaratish yoki yangilash."""
        existing = await self.get_by_telegram_id(telegram_id)
        if existing:
            if full_name:
                existing.full_name = full_name
            if telegram_username:
                existing.telegram_username = telegram_username
            return existing

        user = User(
            telegram_id=telegram_id,
            full_name=full_name,
            telegram_username=telegram_username,
            language_code=language_code,
        )
        self.session.add(user)
        await self.session.flush()
        return user


class WalkInCustomerRepository(BaseRepository[WalkInCustomer]):
    model = WalkInCustomer

    async def find_by_phone(self, phone: str) -> WalkInCustomer | None:
        """Telefon bo'yicha topish (walk-in customers)."""
        result = await self.session.execute(
            select(WalkInCustomer).where(WalkInCustomer.phone == phone)
        )
        return result.scalar_one_or_none()
