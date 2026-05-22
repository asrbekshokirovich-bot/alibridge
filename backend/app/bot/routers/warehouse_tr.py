"""TR warehouse worker router."""

from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

from app.domain.enums import Role

router = Router(name="warehouse_tr")


@router.message(Command("receive"))
async def receive_packages(message: Message, roles: list[Role]) -> None:
    """Carrier yoki kuryerdan paketlarni qabul qilish."""
    if Role.WAREHOUSE_TR not in roles and Role.ADMIN not in roles:
        await message.answer("⛔ Faqat TR ombor xodimlari uchun")
        return

    await message.answer("📦 Qabul — Mini App'ni oching")


@router.message(Command("deliver"))
async def deliver_to_orderer(message: Message, roles: list[Role]) -> None:
    """Buyurtmachiga yakuniy yetkazish."""
    if Role.WAREHOUSE_TR not in roles:
        return

    await message.answer("✅ Yakuniy yetkazish — Mini App'da")
