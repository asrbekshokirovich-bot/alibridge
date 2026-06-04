"""Eskiz.uz SMS provayder integratsiyasi.

API: https://documenter.getpostman.com/view/663428/2s93JqTRWy

Foydalaniladigan joylar:
- Phone OTP (carrier onboarding)
- Landing ping fallback (1h, 6h, 24h)
- Walk-in customer pickup notification
"""

from __future__ import annotations

import httpx

from app.core.config import settings
from app.core.exceptions import SmsError
from app.core.logger import get_logger
from app.infra.cache.redis_client import get_redis

log = get_logger(__name__)

ESKIZ_API_URL = "https://notify.eskiz.uz/api"
TOKEN_CACHE_KEY = "eskiz:token"
TOKEN_TTL = 60 * 60 * 24 * 25  # 25 kun (Eskiz token 30 kun amal qiladi)


class EskizSmsClient:
    """Eskiz.uz REST API client."""

    def __init__(self) -> None:
        self._email = settings.eskiz_email
        self._password = settings.eskiz_password
        self._from = settings.eskiz_from
        self._client = httpx.AsyncClient(timeout=15.0)

    # ============================================
    # Auth
    # ============================================
    async def _get_token(self) -> str:
        """Token'ni cache yoki API'dan olish."""
        redis = get_redis()
        cached = await redis.get(TOKEN_CACHE_KEY)
        if cached:
            return cached

        # Yangi token olish
        resp = await self._client.post(
            f"{ESKIZ_API_URL}/auth/login",
            data={"email": self._email, "password": self._password},
        )
        if resp.status_code != 200:
            raise SmsError(
                message="Eskiz auth muvaffaqiyatsiz",
                details={"status": resp.status_code},
            )

        token = resp.json()["data"]["token"]
        await redis.set(TOKEN_CACHE_KEY, token, ex=TOKEN_TTL)
        log.info("eskiz_token_refreshed")
        return token

    # ============================================
    # Send SMS
    # ============================================
    async def send(self, *, phone: str, message: str) -> dict:
        """SMS yuborish.

        Args:
            phone: telefon raqami (998901234567 formatda, + siz)
            message: matn (max 160 belgi 1 SMS uchun)

        Returns:
            Eskiz response (id, status)

        Raises:
            SmsError: yuborilmadi
        """
        # Telefon normalizatsiya
        phone = phone.lstrip("+").replace(" ", "").replace("-", "")
        if not phone.startswith("998") or len(phone) != 12:
            raise SmsError(
                message="Telefon raqami yaroqsiz (kerakli format: 998XXXXXXXXX)",
                details={"phone": phone},
            )

        token = await self._get_token()

        resp = await self._client.post(
            f"{ESKIZ_API_URL}/message/sms/send",
            headers={"Authorization": f"Bearer {token}"},
            data={
                "mobile_phone": phone,
                "message": message,
                "from": self._from,
            },
        )

        if resp.status_code not in (200, 201):
            raise SmsError(
                message="SMS yuborilmadi",
                details={"status": resp.status_code},
            )

        result = resp.json()
        log.info("sms_sent", phone=phone[-4:], message_id=result.get("id"))
        return result

    async def close(self) -> None:
        await self._client.aclose()


# Singleton
_sms_client: EskizSmsClient | None = None


def get_sms_client() -> EskizSmsClient:
    global _sms_client
    if _sms_client is None:
        _sms_client = EskizSmsClient()
    return _sms_client
