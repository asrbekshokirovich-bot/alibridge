"""i18n middleware — foydalanuvchi tilini aniqlash."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from aiogram import BaseMiddleware
from aiogram.types import TelegramObject

from app.i18n.translator import Translator


class I18nMiddleware(BaseMiddleware):
    """Foydalanuvchi tilini aniqlab, handler'ga 't' (translator) o'zgaruvchisini berish."""

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        # Til prioritet: DB user > Telegram language_code > default 'uz'
        lang = "uz"

        db_user = data.get("db_user")
        if db_user and db_user.language_code:
            lang = db_user.language_code
        else:
            tg_user = data.get("event_from_user")
            if tg_user and tg_user.language_code:
                lang = tg_user.language_code[:2]
                if lang not in {"uz", "ru", "tr", "en"}:
                    lang = "uz"

        data["lang"] = lang
        data["t"] = Translator(lang)

        return await handler(event, data)
