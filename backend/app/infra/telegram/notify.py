"""Telegram bildirishnoma helperlari.

Best-effort: xato bo'lsa (bloklangan bot, noto'g'ri chat_id) asosiy oqimni
buzmaydi — faqat warning loglaydi.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import get_logger
from app.domain.enums import Role
from app.infra.db.models.user import User, UserRole

log = get_logger(__name__)


async def notify_user(tg_id: int | None, text: str) -> bool:
    """Bitta foydalanuvchiga Telegram xabar yuborish (best-effort)."""
    if not tg_id:
        return False
    from app.infra.telegram.bot import bot

    try:
        await bot.send_message(tg_id, text)
        return True
    except Exception as e:  # noqa: BLE001 — bildirishnoma asosiy oqimni buzmasin
        log.warning("notify_user_failed", tg_id=tg_id, error=str(e))
        return False


async def notify_user_id(session: AsyncSession, user_id: uuid.UUID, text: str) -> bool:
    """Foydalanuvchi UUID bo'yicha (telegram_id ni topib) xabar yuborish."""
    tg_id = await session.scalar(select(User.telegram_id).where(User.id == user_id))
    return await notify_user(tg_id, text)


async def notify_role(session: AsyncSession, role: Role, text: str) -> int:
    """Berilgan roldagi barcha (aktiv) foydalanuvchilarga xabar. Yuborilgan soni."""
    result = await session.execute(
        select(User.telegram_id)
        .join(UserRole, UserRole.user_id == User.id)
        .where(UserRole.role == role.value, UserRole.revoked_at.is_(None))
    )
    sent = 0
    for tg_id in result.scalars().all():
        if await notify_user(tg_id, text):
            sent += 1
    return sent
