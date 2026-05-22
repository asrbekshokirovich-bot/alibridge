"""Telegram Mini App initData HMAC tekshiruvi.

Bu rasmiy Telegram algoritmi (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):

1. initData query string'ni parslash
2. `hash` parametrini olib qo'yish
3. Qolgan barcha kalit=qiymat juftliklarini saralash va `\n` bilan birlashtirish (data_check_string)
4. secret_key = HMAC-SHA256(key="WebAppData", message=bot_token)
5. hash = HMAC-SHA256(key=secret_key, message=data_check_string)
6. Hisoblangan hash kelgan `hash` bilan tenglashtirish

Bu Mini App sahifa ochilganda Telegram tomonidan jo'natiladigan
init payload'ning autentikligini tasdiqlaydi.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from typing import Any
from urllib.parse import parse_qsl, unquote

from app.core.config import settings
from app.core.exceptions import TelegramAuthError


# initData maksimum yoshi (eskirish vaqti) — 5 daqiqa (Telegram tavsiyasi)
# 24 soat (86400) — replay hujumiga eshik ochadi
MAX_INIT_DATA_AGE = 300


def validate_init_data(init_data: str, *, max_age: int = MAX_INIT_DATA_AGE) -> dict[str, Any]:
    """Telegram Mini App initData'ni tekshirish.

    Args:
        init_data: Mini App'dan kelgan raw initData query string
        max_age: maksimum yosh (sekundlarda); 0 = tekshirmaslik

    Returns:
        Parsed initData (user, auth_date, query_id, ...)

    Raises:
        TelegramAuthError: imzo yaroqsiz yoki muddati o'tgan
    """
    if not init_data:
        raise TelegramAuthError(message="initData bo'sh")

    # 1. Parse query string
    parsed = dict(parse_qsl(init_data, keep_blank_values=True))

    # 2. Hash'ni olib qo'yish
    received_hash = parsed.pop("hash", None)
    if not received_hash:
        raise TelegramAuthError(message="initData'da hash yo'q")

    # 3. data_check_string yaratish
    data_check_string = "\n".join(
        f"{key}={value}" for key, value in sorted(parsed.items())
    )

    # 4. Secret key (bot_token bilan)
    secret_key = hmac.new(
        key=b"WebAppData",
        msg=settings.bot_token.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).digest()

    # 5. Computed hash
    computed_hash = hmac.new(
        key=secret_key,
        msg=data_check_string.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()

    # 6. Tenglashtirish
    if not hmac.compare_digest(computed_hash, received_hash):
        raise TelegramAuthError(message="initData imzosi yaroqsiz")

    # 7. Yosh tekshiruvi
    if max_age > 0:
        try:
            auth_date = int(parsed.get("auth_date", "0"))
        except ValueError as e:
            raise TelegramAuthError(message="auth_date noto'g'ri formatda") from e

        age = time.time() - auth_date
        if age > max_age:
            raise TelegramAuthError(
                message="initData muddati o'tgan",
                details={"age_seconds": int(age), "max_age": max_age},
            )

    return parse_init_data(parsed)


def parse_init_data(parsed: dict[str, str]) -> dict[str, Any]:
    """Parsed initData ichidagi user JSON'ni dekodlash."""
    result: dict[str, Any] = dict(parsed)

    # user maydoni JSON — uni parse qilish
    if "user" in result:
        try:
            result["user"] = json.loads(unquote(result["user"]))
        except (json.JSONDecodeError, ValueError) as e:
            raise TelegramAuthError(message="user JSON yaroqsiz") from e

    # auth_date'ni int'ga o'tkazish
    if "auth_date" in result:
        try:
            result["auth_date"] = int(result["auth_date"])
        except ValueError:
            pass  # original string qoldirish

    return result
