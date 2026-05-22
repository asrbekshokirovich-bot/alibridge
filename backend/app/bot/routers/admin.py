"""Admin router — boshqaruv operatsiyalari."""

from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

from app.domain.enums import Role

router = Router(name="admin")


@router.message(Command("admin"))
async def admin_panel(message: Message, roles: list[Role]) -> None:
    """Admin paneli."""
    if Role.ADMIN not in roles:
        await message.answer("⛔ Faqat admin uchun")
        return

    await message.answer(
        "👤 <b>Admin Panel</b>\n\n"
        "Barcha funksiyalar Mini App'da:\n"
        "• Foydalanuvchilarga rol berish\n"
        "• Buyurtmalarni ko'rib chiqish\n"
        "• Payout'larni tasdiqlash\n"
        "• Dispute'larni hal qilish\n"
        "• Statistika"
    )


@router.message(Command("grant"))
async def grant_role(message: Message, roles: list[Role]) -> None:
    """Foydalanuvchiga rol berish.

    Format: /grant <telegram_id> <role>
    """
    if Role.ADMIN not in roles:
        return

    # TODO: parse va grant
    await message.answer("Rol berish — Mini App orqali")
