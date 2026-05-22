"""Telegram bot webhook endpoint.

aiogram Dispatcher xabar'larni qabul qilib, mos handler'lar chaqiradi.
"""

from __future__ import annotations

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
    # Secret token tekshiruvi (agar webhook secret o'rnatilgan bo'lsa)
    if settings.bot_webhook_secret:
        if x_telegram_bot_api_secret_token != settings.bot_webhook_secret:
            raise UnauthorizedError(message="Telegram webhook secret yaroqsiz")

    update_data = await request.json()

    # aiogram'ga uzatish
    from aiogram.types import Update

    update = Update.model_validate(update_data)
    await dp.feed_update(bot, update)

    return {"ok": True}
