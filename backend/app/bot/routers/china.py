"""China worker router (cheklangan ko'rinish)."""

from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

from app.domain.enums import Role

router = Router(name="china")


@router.message(Command("tickets"))
async def open_tickets(message: Message, roles: list[Role]) -> None:
    """Ochiq sourcing tickets (faqat spec ma'lumotlari)."""
    if Role.CHINA_WORKER not in roles:
        await message.answer("⛔ Faqat Xitoy xodimlari uchun")
        return

    await message.answer("📋 Tickets — Mini App'ni oching")
