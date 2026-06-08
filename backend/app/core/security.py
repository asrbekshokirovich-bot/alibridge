import hashlib
import hmac
import json
import time
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qsl

from jose import JWTError, jwt

from app.core.config import settings
from app.core.errors import AppError

# ─── JWT ──────────────────────────────────────────────────────────────────────


def create_access_token(user_id: int, role: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as e:
        raise AppError("UNAUTHORIZED", "Token yaroqsiz", status_code=401) from e
    if "sub" not in payload:
        raise AppError("UNAUTHORIZED", "Token yaroqsiz", status_code=401)
    return payload


# ─── Telegram initData HMAC ─────────────────────────────────────────────────────
# https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app


def _build_secret_key(bot_token: str) -> bytes:
    return hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()


def verify_init_data(init_data: str, max_age_seconds: int = 86400) -> dict:
    """Telegram WebApp initData ni tekshiradi va `user` dict qaytaradi.

    Xato bo'lsa AppError ko'taradi.
    """
    if not init_data:
        raise AppError("INVALID_INIT_DATA", "Telegram ma'lumoti yo'q", status_code=401)

    try:
        parsed = dict(parse_qsl(init_data, strict_parsing=True))
    except ValueError as e:
        raise AppError("INVALID_INIT_DATA", "Init data formati buzilgan", status_code=401) from e

    received_hash = parsed.pop("hash", None)
    if not received_hash:
        raise AppError("INVALID_INIT_DATA", "Hash topilmadi", status_code=401)

    # data_check_string: kalitlar alifbo tartibida, key=value, \n bilan
    data_check_string = "\n".join(f"{k}={parsed[k]}" for k in sorted(parsed))
    secret_key = _build_secret_key(settings.bot_token)
    calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(calculated_hash, received_hash):
        raise AppError("INVALID_INIT_DATA", "Imzo tekshiruvi muvaffaqiyatsiz", status_code=401)

    # auth_date eskirganini tekshirish
    auth_date = parsed.get("auth_date")
    if auth_date:
        try:
            if time.time() - int(auth_date) > max_age_seconds:
                raise AppError("INIT_DATA_EXPIRED", "Telegram ma'lumoti eskirgan", status_code=401)
        except ValueError:
            pass

    user_raw = parsed.get("user")
    if not user_raw:
        raise AppError("INVALID_INIT_DATA", "Foydalanuvchi ma'lumoti yo'q", status_code=401)

    try:
        user = json.loads(user_raw)
    except ValueError as e:
        raise AppError("INVALID_INIT_DATA", "User JSON buzilgan", status_code=401) from e

    return {
        "id": int(user["id"]),
        "first_name": user.get("first_name", ""),
        "last_name": user.get("last_name", ""),
        "username": user.get("username", ""),
    }
