"""Landing ping eskalatsiya — DEV_PLAN §11.1.

Carrier qo'ngandan keyin manzilini bermasa:
- +1h: bot pinging
- +6h: bot + SMS
- +24h: admin alert + AT_RISK flag
- +72h: LIKELY_LOST + blacklist
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.logger import get_logger
from app.domain.enums import Role
from app.infra.db.session import AsyncSessionLocal
from app.infra.sms import get_sms_client
from app.infra.telegram.bot import bot
from app.repositories.carrier_repo import CarrierProfileRepository

log = get_logger(__name__)


async def escalate_landing_pings(ctx: dict[str, Any]) -> int:
    """4 bosqichli eskalatsiya.

    Returns:
        Yuborilgan ping'lar soni
    """
    sent_count = 0

    async with AsyncSessionLocal() as session:
        repo = CarrierProfileRepository(session)

        # +1h
        for profile in await repo.get_pending_landings(hours_since_arrival=1):
            try:
                await bot.send_message(
                    profile.user_id,  # actually telegram_id but we need to look up
                    "✈️ Siz qo'ngan bo'lsangiz kerak. Iltimos, Turkiyadagi manzilingizni Mini App'da kiriting.",
                )
                sent_count += 1
            except Exception as e:
                log.warning("ping_1h_failed", user_id=str(profile.user_id), error=str(e))

        # +6h: SMS qo'shish
        # +24h: admin alert
        # +72h: blacklist
        # TODO: to'liq logika

        await session.commit()

    log.info("landing_pings_sent", count=sent_count)
    return sent_count
