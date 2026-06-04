"""Auth middleware — har xabar uchun User va rollarni yuklash.

Optimizatsiya: Redis cache.
Har xabarda 2 ta Supabase DB so'rovi o'rniga Redis cache'dan foydalanamiz.
Cache miss (yangi foydalanuvchi yoki TTL o'tgan) bo'lgandagina DB'ga murojaat qilamiz.
"""

from __future__ import annotations

import json
import types
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from aiogram import BaseMiddleware
from aiogram.types import TelegramObject, User as TgUser

from app.core.logger import get_logger
from app.domain.enums import Role
from app.infra.cache.redis_client import get_redis
from app.infra.db.session import AsyncSessionLocal
from app.repositories.user_repo import UserRepository

log = get_logger(__name__)

# 30 daqiqa — rol o'zgarishi nodir + grant/revoke da cache invalidatsiya qilinadi
# (L3). Uzoq TTL = Supabase'ga kamroq murojaat = botning tezroq javobi.
_CACHE_TTL = 1800


class AuthMiddleware(BaseMiddleware):
    """Har xabar uchun User va rollarni yuklash (Redis cache bilan)."""

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        tg_user: TgUser | None = data.get("event_from_user")
        if tg_user is None or tg_user.is_bot:
            return await handler(event, data)

        # ── 1. Redis cache tekshiruvi ─────────────────────────────────────────
        cache_key = f"bot:auth:{tg_user.id}"
        try:
            raw = await get_redis().get(cache_key)
            if raw:
                cached = json.loads(raw)
                data["db_user"] = types.SimpleNamespace(
                    id=uuid.UUID(cached["user_id"]),
                    language_code=cached.get("language_code") or "uz",
                    full_name=cached.get("full_name"),
                    telegram_username=cached.get("telegram_username"),
                )
                data["roles"] = [Role(r) for r in cached.get("roles", [])]
                return await handler(event, data)
        except Exception:
            pass  # cache xato → DB'dan yuklaymiz

        # ── 2. DB lookup (cache miss) ─────────────────────────────────────────
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
            data["db_user"] = user
            data["roles"] = roles

        # ── 3. Cache'ga yozish ────────────────────────────────────────────────
        try:
            await get_redis().setex(
                cache_key,
                _CACHE_TTL,
                json.dumps({
                    "user_id": str(user.id),
                    "language_code": user.language_code,
                    "full_name": user.full_name,
                    "telegram_username": user.telegram_username,
                    "roles": [r.value for r in roles],
                }),
            )
        except Exception:
            pass  # cache yozish muvaffaqiyatsiz bo'lsa — davom etaveradi

        return await handler(event, data)
