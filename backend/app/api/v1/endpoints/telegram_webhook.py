"""Telegram bot webhook endpoint.

aiogram Dispatcher xabar'larni qabul qilib, mos handler'lar chaqiradi.
"""

from __future__ import annotations

import hmac

from fastapi import APIRouter, Header, Request

from app.core.config import settings
from app.core.exceptions import UnauthorizedError
from app.infra.telegram.bot import bot, dp

router = APIRouter()


@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(None),
) -> dict:
    """Telegram update'larni qabul qilish."""
    # H2: webhook secret production'da majburiy. Aks holda hujumchi soxta
    # Telegram update yuborib, ixtiyoriy foydalanuvchi nomidan (admin ham)
    # bot komandalarini ishga tushira oladi.
    secret = settings.bot_webhook_secret
    if not secret:
        if settings.is_production:
            raise UnauthorizedError(message="Webhook secret sozlanmagan")
        # Dev'da secret bo'lmasa — ogohlantirishsiz o'tkazib yuboriladi
    else:
        # Constant-time taqqoslash (timing attack oldini olish)
        provided = x_telegram_bot_api_secret_token or ""
        if not hmac.compare_digest(provided, secret):
            raise UnauthorizedError(message="Telegram webhook secret yaroqsiz")

    update_data = await request.json()

    # aiogram'ga uzatish
    from aiogram.types import Update

    update = Update.model_validate(update_data)
    await dp.feed_update(bot, update)

    return {"ok": True}
