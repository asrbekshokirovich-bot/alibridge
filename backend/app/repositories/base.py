"""Base repository — barcha repository'lar uchun umumiy funksionallik."""

from __future__ import annotations

import uuid
from typing import Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.db.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    """Umumiy CRUD operatsiyalari.

    Subclasses model'ni o'rnatadi:
        class UserRepo(BaseRepository[User]):
            model = User
    """

    model: type[ModelT]

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, entity_id: uuid.UUID) -> ModelT | None:
        """ID bo'yicha topish."""
        result = await self.session.execute(
            select(self.model).where(self.model.id == entity_id)  # type: ignore[attr-defined]
        )
        return result.scalar_one_or_none()

    async def add(self, entity: ModelT) -> ModelT:
        """Yangi yozuv qo'shish."""
        self.session.add(entity)
        await self.session.flush()
        return entity

    async def delete(self, entity: ModelT) -> None:
        """Yozuvni o'chirish (custody_events uchun MAN ETILGAN)."""
        await self.session.delete(entity)
        await self.session.flush()
