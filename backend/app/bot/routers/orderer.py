"""Orderer (buyurtmachi) router.

Asosiy oqim:
1. /orders — mening buyurtmalarim
2. Mini App orqali yangi buyurtma yaratish
3. Status kuzatish
"""

from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

from app.domain.enums import Role

router = Router(name="orderer")


@router.message(Command("orders"))
async def my_orders(message: Message, roles: list[Role]) -> None:
    """Mening buyurtmalarim."""
    if Role.ORDERER not in roles:
        await message.answer("⛔ Sizda buyurtmachi roli yo'q")
        return

    # TODO: DB'dan buyurtmalarni olish va ko'rsatish
    await message.answer("📋 Buyurtmalaringiz Mini App'da ko'rinadi")
