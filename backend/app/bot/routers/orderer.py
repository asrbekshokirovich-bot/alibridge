"""Orderer (buyurtmachi) router."""

from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

from app.domain.enums import Role

router = Router(name="orderer")

_STATUS_EMOJI = {
    "draft":               "📝",
    "pending_sourcing":    "⏳",
    "sourcing":            "🔍",
    "in_transit_cn_uz":    "🚢",
    "at_tashkent":         "🏭",
    "in_transit_uz_tr":    "✈️",
    "at_tr_wh":            "🏬",
    "partially_delivered": "📦",
    "delivered":           "✅",
    "cancelled":           "❌",
    "disputed":            "⚖️",
}


@router.message(Command("orders"))
async def my_orders(message: Message, roles: list[Role], db_user) -> None:
    """Mening buyurtmalarim — oxirgi 10 ta."""
    if Role.ORDERER not in roles:
        await message.answer("⛔ Sizda buyurtmachi roli yo'q")
        return

    from sqlalchemy import select
    from app.infra.db.models.order import Order
    from app.infra.db.session import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        orders = list((await session.execute(
            select(Order)
            .where(Order.orderer_user_id == db_user.id)
            .order_by(Order.created_at.desc())
            .limit(10)
        )).scalars().all())

    if not orders:
        await message.answer(
            "📋 Buyurtmalaringiz yo'q.\n\nYangi buyurtma berish uchun Mini App'ni oching."
        )
        return

    lines = ["📋 <b>Oxirgi buyurtmalaringiz:</b>\n"]
    for o in orders:
        emoji = _STATUS_EMOJI.get(o.status, "📦")
        short_id = str(o.id)[:8].upper()
        date_str = o.created_at.strftime("%d.%m.%Y")
        lines.append(f"{emoji} <code>#{short_id}</code> — {o.status} ({date_str})")

    lines.append("\nBatafsil: Mini App'ni oching")
    await message.answer("\n".join(lines), parse_mode="HTML")
