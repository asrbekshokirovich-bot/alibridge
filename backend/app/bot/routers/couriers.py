"""UZ va TR kuryer router'lari (bir router)."""

from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

from app.domain.enums import Role

router = Router(name="couriers")


@router.message(Command("dispatches"))
async def my_dispatches(message: Message, roles: list[Role]) -> None:
    """Mening dispatch queue'm."""
    if Role.COURIER_UZ not in roles and Role.COURIER_TR not in roles:
        await message.answer("⛔ Faqat kuryerlar uchun")
        return

    await message.answer("📋 Vazifalaringiz — Mini App'ni oching")
