"""Tashkent warehouse worker router."""

from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

from app.domain.enums import Role

router = Router(name="warehouse_uz")


@router.message(Command("intake"))
async def start_intake(message: Message, roles: list[Role]) -> None:
    """Yangi shipment qabul qilish."""
    if Role.WAREHOUSE_UZ not in roles and Role.ADMIN not in roles:
        await message.answer("⛔ Faqat ombor xodimlari uchun")
        return

    await message.answer(
        "📦 Yangi yetkazib berishni qabul qiling — Mini App'ni oching"
    )


@router.message(Command("scan"))
async def scan_session(message: Message, roles: list[Role]) -> None:
    """Carrier'ga topshirish uchun skan sessiyasi."""
    if Role.WAREHOUSE_UZ not in roles:
        await message.answer("⛔ Sizda ruxsat yo'q")
        return

    await message.answer("📷 Skanerlash — Mini App'ni oching")
