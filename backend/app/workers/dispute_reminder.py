"""Stale dispute reminder — 48 soatdan ko'p hal qilinmagan dispute'lar."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select

from app.core.logger import get_logger
from app.domain.enums import Role
from app.infra.db.models.dispute import Dispute
from app.infra.db.models.user import UserRole
from app.infra.db.session import AsyncSessionLocal
from app.infra.telegram.bot import bot

log = get_logger(__name__)


async def remind_stale_disputes(ctx: dict[str, Any]) -> int:
    """48 soatdan ortiq hal qilinmagan dispute'lar haqida adminga eslatma."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
    sent_count = 0

    async with AsyncSessionLocal() as session:
        # Hal qilinmagan va 48 soatdan eski dispute'lar
        disputes = list((await session.execute(
            select(Dispute)
            .where(Dispute.resolved_at.is_(None))
            .where(Dispute.raised_at <= cutoff)
        )).scalars().all())

        if not disputes:
            log.debug("dispute_reminder_ran", stale=0)
            return 0

        # Admin foydalanuvchilarning telegram_id larini olish
        from app.infra.db.models.user import User
        admin_tg_ids = list((await session.execute(
            select(User.telegram_id)
            .join(UserRole, UserRole.user_id == User.id)
            .where(UserRole.role == Role.ADMIN.value)
            .where(UserRole.revoked_at.is_(None))
        )).scalars().all())

        if not admin_tg_ids:
            log.warning("dispute_reminder_no_admins")
            return 0

        count = len(disputes)
        oldest = min(disputes, key=lambda d: d.raised_at)
        hours_old = int((datetime.now(timezone.utc) - oldest.raised_at).total_seconds() / 3600)

        text = (
            f"⚖️ <b>Hal qilinmagan nizolar: {count} ta</b>\n\n"
            f"Eng eskisi: {hours_old} soat avval ochilgan.\n"
            f"Iltimos, Admin panelda ko'rib chiqing."
        )

        for tg_id in admin_tg_ids:
            try:
                await bot.send_message(tg_id, text, parse_mode="HTML")
                sent_count += 1
            except Exception as e:
                log.warning("dispute_reminder_send_failed", tg_id=tg_id, error=str(e))

    log.info("dispute_reminder_ran", stale=count, notified=sent_count)
    return sent_count
