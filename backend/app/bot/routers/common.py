"""Umumiy bot router — /start, /help, fallback."""

from __future__ import annotations

from aiogram import F, Router
from aiogram.filters import CommandStart, Command
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    WebAppInfo,
)

from app.core.config import settings
from app.core.logger import get_logger
from app.i18n.translator import Translator

log = get_logger(__name__)
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


# ============================================
# Fallback — hech qanday handler mos kelmasa
# ============================================
@router.message()
async def fallback_message(message: Message, t: Translator) -> None:
    """Har qanday mos kelmagan xabar uchun fallback."""
    log.debug("unhandled_message", user_id=message.from_user.id if message.from_user else None)
    await message.answer(
        f"👋 <b>ALI BRIDGE</b>\n\n"
        f"Ilovani ochish uchun /start buyrug'ini yuboring\n"
        f'yoki <a href="{settings.miniapp_url}">bu havolani</a> bosing.',
    )


@router.callback_query()
async def fallback_callback(callback: CallbackQuery) -> None:
    """Mos kelmagan callback query uchun fallback."""
    log.debug("unhandled_callback", data=callback.data, user_id=callback.from_user.id if callback.from_user else None)
    await callback.answer("⚠️ Bu tugma endi ishlamaydi. /start ni bosing.", show_alert=True)
