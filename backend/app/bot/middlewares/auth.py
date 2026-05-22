"""Auth middleware — har xabar uchun User va rollarni yuklash."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from aiogram import BaseMiddleware
from aiogram.types import TelegramObject, User as TgUser

from app.core.logger import get_logger
from app.infra.db.session import AsyncSessionLocal
from app.repositories.user_repo import UserRepository

log = get_logger(__name__)


class AuthMiddleware(BaseMiddleware):
    """Har xabar uchun User'ni DB'dan yuklash (yoki yaratish)."""

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        tg_user: TgUser | None = data.get("event_from_user")

        if tg_user is None or tg_user.is_bot:
            return await handler(event, data)

        async with AsyncSessionLocal() as session:
            repo = UserRepository(session)

            user = await repo.upsert_telegram_user(
                telegram_id=tg_user.id,
                full_name=tg_user.full_name,
                telegram_username=tg_user.username,
                language_code=tg_user.language_code or "uz",
            )
            await session.commit()

            roles = await repo.get_roles(user.id)

            # Handler uchun data'ga qo'shish
            data["db_user"] = user
            data["roles"] = roles

        return await handler(event, data)
