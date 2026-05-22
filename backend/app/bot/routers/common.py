"""Umumiy bot router — /start, /help."""

from __future__ import annotations

from aiogram import Router
from aiogram.filters import CommandStart, Command
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    WebAppInfo,
)

from app.core.config import settings
from app.i18n.translator import Translator

router = Router(name="common")


# ============================================
# /start
# ============================================
@router.message(CommandStart())
async def cmd_start(message: Message, t: Translator) -> None:
    """Foydalanuvchini kutib olish + Mini App tugmasi."""
    user_name = message.from_user.first_name if message.from_user else "Foydalanuvchi"

    # Mini App tugmasi faqat HTTPS public URL da ishlaydi (Telegram talabi)
    is_public_https = (
        settings.miniapp_url.startswith("https://")
        and "localhost" not in settings.miniapp_url
        and "127.0.0.1" not in settings.miniapp_url
    )

    if is_public_https:
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(
                    text=t("start.open_app"),
                    web_app=WebAppInfo(url=settings.miniapp_url),
                )
            ],
        ])
        extra = ""
    else:
        # Local dev: Mini App URL ko'rsatiladi
        keyboard = InlineKeyboardMarkup(inline_keyboard=[])
        extra = f"\n\n🖥 <b>Dev rejim</b>\nMini App: <code>{settings.miniapp_url}</code>"

    await message.answer(
        f"{t('common.welcome', name=user_name)}\n\n{t('start.greeting')}{extra}",
        reply_markup=keyboard,
    )


# ============================================
# /help
# ============================================
@router.message(Command("help"))
async def cmd_help(message: Message, t: Translator) -> None:
    """Yordam."""
    text = (
        "📚 <b>ALI BRIDGE Yordam</b>\n\n"
        "/start — Botni qayta ishga tushirish\n"
        "/help — Bu yordam\n"
        "/profile — Profilim\n\n"
        f'Asosiy ilovani <a href="{settings.miniapp_url}">bu yerdan</a> oching.'
    )
    await message.answer(text)
