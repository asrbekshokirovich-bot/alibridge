"""Anti-spam throttling middleware — Redis bilan foydalanuvchi bo'yicha cheklash.

Qoidalar:
  - 3 soniya ichida 5 ta xabardan ko'p → ogohlantirish + 30 soniya blok
  - Blok davomida barcha xabarlar jim e'tiborga olinmaydi
  - Callback query'lar ham hisoblanadi
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from aiogram import BaseMiddleware
from aiogram.types import CallbackQuery, Message, TelegramObject

from app.infra.cache.redis_client import get_redis

# ── Sozlamalar ─────────────────────────────────────────────────────────────────
RATE_LIMIT   = 5   # Qancha xabar ...
RATE_WINDOW  = 3   # ... N soniya ichida ruxsat etiladi
BAN_DURATION = 30  # Limit oshirilganda N soniya bloklanadi


class ThrottlingMiddleware(BaseMiddleware):
    """Foydalanuvchi bo'yicha spam himoyasi (Redis-backed)."""

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        # Foydalanuvchi ID ni aniqlash
        tg_user = data.get("event_from_user")
        if tg_user is None or tg_user.is_bot:
            return await handler(event, data)

        user_id = tg_user.id
        redis = get_redis()

        ban_key   = f"spam:ban:{user_id}"
        count_key = f"spam:count:{user_id}"

        # 1. Blokda turibdimi?
        if await redis.exists(ban_key):
            # Birinchi bloklanganda ogohlantirish yuboriladi
            # (keyingi urinishlar jim o'tkazib yuboriladi)
            return  # jim e'tiborga olinmaydi

        # 2. Xabar sonini oshirish
        pipe = redis.pipeline()
        pipe.incr(count_key)
        pipe.expire(count_key, RATE_WINDOW)
        results = await pipe.execute()
        count: int = results[0]

        # 3. Limit oshganmi?
        if count > RATE_LIMIT:
            # Blok qo'yish
            await redis.setex(ban_key, BAN_DURATION, "1")

            # Foydalanuvchiga bir marta ogohlantirish
            warn = f"⚠️ Juda tez xabar yuboryapsiz!\n{BAN_DURATION} soniyadan so'ng qayta urinib ko'ring."
            if isinstance(event, Message):
                await event.answer(warn)
            elif isinstance(event, CallbackQuery):
                await event.answer(warn, show_alert=True)

            return  # handler chaqirilmaydi

        # 4. Odatiy yo'l
        return await handler(event, data)
