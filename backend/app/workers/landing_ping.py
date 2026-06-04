"""Landing ping eskalatsiya — DEV_PLAN §11.1.

Carrier qo'ngandan keyin manzilini bermasa:
- +1h: bot ping
- +6h: bot + SMS
- +24h: admin alert
- +72h: blacklist
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select

from app.core.logger import get_logger
from app.domain.enums import Role
from app.infra.db.models.carrier import CarrierProfile
from app.infra.db.models.user import User, UserRole
from app.infra.db.session import AsyncSessionLocal
from app.infra.sms import get_sms_client
from app.infra.telegram.bot import bot
from app.repositories.carrier_repo import CarrierProfileRepository

log = get_logger(__name__)

_BOT_MSG_1H = (
    "✈️ Siz Turkiyaga qo'ngan bo'lsangiz kerak.\n"
    "Iltimos, Mini App'da manzilingizni kiriting."
)
_BOT_MSG_6H = (
    "⚠️ Siz qo'nganingizga 6 soat bo'ldi, lekin manzil hali kiritilmagan.\n"
    "Iltimos, <b>hoziroq</b> Mini App'da manzilingizni kiriting yoki "
    "bizga bog'laning."
)
_SMS_MSG_6H = "ALI BRIDGE: Turkiyaga qo'ngandan keyin manzilingizni kiriting. Mini App'ni oching."
_BOT_MSG_24H = (
    "🚨 24 soat o'tdi — manzil hali yo'q.\n"
    "Hisobingiz tekshiruv ostiga olindi. Admin siz bilan bog'lanadi."
)


async def escalate_landing_pings(ctx: dict[str, Any]) -> int:
    """4 bosqichli eskalatsiya."""
    sent_count = 0
    now = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as session:
        repo = CarrierProfileRepository(session)

        # Admin telegram_id'lari (24h alert uchun)
        admin_tg_ids = list((await session.execute(
            select(User.telegram_id)
            .join(UserRole, UserRole.user_id == User.id)
            .where(UserRole.role == Role.ADMIN.value)
            .where(UserRole.revoked_at.is_(None))
        )).scalars().all())

        async def _get_user(profile: CarrierProfile) -> User | None:
            return (await session.execute(
                select(User).where(User.id == profile.user_id)
            )).scalar_one_or_none()

        async def _bot_send(tg_id: int, text: str) -> bool:
            try:
                await bot.send_message(tg_id, text, parse_mode="HTML")
                return True
            except Exception as e:
                log.warning("ping_bot_failed", tg_id=tg_id, error=str(e))
                return False

        async def _sms_send(phone: str, text: str) -> bool:
            try:
                await get_sms_client().send(phone=phone, message=text)
                return True
            except Exception as e:
                log.warning("ping_sms_failed", phone=phone[-4:], error=str(e))
                return False

        # ── +1h: bot ping ──────────────────────────────────────────────────────
        for profile in await repo.get_pending_landings(hours_since_arrival=1):
            # Faqat 1h dan 6h gacha bo'lganlar (6h bosqich buni qoplamasin)
            hours_waiting = (now - profile.arrive_at).total_seconds() / 3600
            if hours_waiting >= 6:
                continue
            user = await _get_user(profile)
            if user and await _bot_send(user.telegram_id, _BOT_MSG_1H):
                sent_count += 1

        # ── +6h: bot + SMS ─────────────────────────────────────────────────────
        for profile in await repo.get_pending_landings(hours_since_arrival=6):
            hours_waiting = (now - profile.arrive_at).total_seconds() / 3600
            if hours_waiting >= 24:
                continue
            user = await _get_user(profile)
            if not user:
                continue
            if await _bot_send(user.telegram_id, _BOT_MSG_6H):
                sent_count += 1
            if user.phone:
                await _sms_send(user.phone, _SMS_MSG_6H)

        # ── +24h: admin alert ──────────────────────────────────────────────────
        for profile in await repo.get_pending_landings(hours_since_arrival=24):
            hours_waiting = (now - profile.arrive_at).total_seconds() / 3600
            if hours_waiting >= 72:
                continue
            user = await _get_user(profile)
            if not user:
                continue
            # Carrierga xabar
            await _bot_send(user.telegram_id, _BOT_MSG_24H)
            # Adminga alert
            alert = (
                f"🚨 <b>Carrier 24 soatdan beri manzil bermadi</b>\n\n"
                f"Foydalanuvchi: {user.full_name or 'nomaʼlum'}\n"
                f"@{user.telegram_username or '—'}\n"
                f"Qo'nish vaqti: {profile.arrive_at.strftime('%d.%m %H:%M')} UTC"
            )
            for tg_id in admin_tg_ids:
                await _bot_send(tg_id, alert)
            sent_count += 1

        # ── +72h: blacklist ────────────────────────────────────────────────────
        for profile in await repo.get_pending_landings(hours_since_arrival=72):
            user = await _get_user(profile)
            profile.blacklisted_at = now
            log.warning(
                "carrier_blacklisted_no_landing",
                user_id=str(profile.user_id),
                full_name=user.full_name if user else "unknown",
            )
            if user:
                blocked_msg = (
                    "🚫 Hisobingiz vaqtincha bloklandi.\n"
                    "Turkiyadagi manzilingizni kiriting yoki admin bilan bog'laning."
                )
                await _bot_send(user.telegram_id, blocked_msg)
                alert = (
                    f"🚫 <b>Carrier avtomatik bloklandi (72h manzilsiz)</b>\n\n"
                    f"{user.full_name or '—'} | @{user.telegram_username or '—'}"
                )
                for tg_id in admin_tg_ids:
                    await _bot_send(tg_id, alert)
            sent_count += 1

        await session.commit()

    log.info("landing_pings_sent", count=sent_count)
    return sent_count
