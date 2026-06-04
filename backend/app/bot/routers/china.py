"""China worker bot router — sourcing uchun Mini App'ni ochadi."""

from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

from app.domain.enums import Role

router = Router(name="china")


@router.message(Command("sourcing"))
async def my_sourcing(message: Message, roles: list[Role]) -> None:
    """Sourcing vazifalari — Mini App'ni oching."""
    if Role.CHINA_WORKER not in roles:
        await message.answer("⛔ Faqat China worker uchun")
        return

    await message.answer("🛒 Sourcing vazifalari — Mini App'ni oching")
