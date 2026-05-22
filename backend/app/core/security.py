"""Xavfsizlik utilitalar: JWT, parol hash, encryption.

Bu modul:
- JWT token yaratish va tekshirish
- Mini App initData → JWT konversiya
- Fernet bilan ma'lumotni shifrlash (passport rasmi uchun)
"""

from __future__ import annotations

import base64
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from cryptography.fernet import Fernet
from passlib.context import CryptContext

from app.core.config import settings
from app.core.exceptions import UnauthorizedError

# Parol hashing (kerak bo'lganda)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ============================================
# JWT
# ============================================
def create_access_token(
    *,
    user_id: uuid.UUID,
    roles: list[str],
    extra_claims: dict[str, Any] | None = None,
    expires_in: int | None = None,
) -> str:
    """JWT access token yaratish.

    Args:
        user_id: foydalanuvchi ID (sub claim)
        roles: ro'yxat shaklidagi rollar
        extra_claims: qo'shimcha claim'lar
        expires_in: muddati daqiqalarda (default settings.jwt_expire_minutes)

    Returns:
        JWT string (Bearer header'da yuboriladi)
    """
    expire_minutes = expires_in or settings.jwt_expire_minutes
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=expire_minutes)

    payload: dict[str, Any] = {
        "sub": str(user_id),
        "roles": roles,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "jti": str(uuid.uuid4()),  # unique token ID (revoke uchun)
    }
    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    """JWT token'ni dekodlash va tekshirish.

    Raises:
        UnauthorizedError: token expired, invalid yoki noto'g'ri imzo
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except jwt.ExpiredSignatureError as e:
        raise UnauthorizedError(message="Token muddati tugadi") from e
    except jwt.InvalidTokenError as e:
        raise UnauthorizedError(message="Token yaroqsiz") from e


# ============================================
# Encryption (passport va boshqa shaxsiy ma'lumotlar uchun)
# ============================================
def _get_fernet() -> Fernet:
    """Fernet shifrlovchini olish (encryption_key'dan)."""
    key = settings.encryption_key.encode("utf-8")
    # Fernet 32-byte base64 kalit talab qiladi
    if len(key) != 44:  # base64 length of 32 bytes
        # Agar oddiy hex bo'lsa, base64 ga o'tkazish
        try:
            raw = bytes.fromhex(settings.encryption_key)
            if len(raw) != 32:
                raise ValueError(
                    "ENCRYPTION_KEY 32-byte hex yoki 44-belgi base64 bo'lishi shart"
                )
            key = base64.urlsafe_b64encode(raw)
        except ValueError as e:
            raise RuntimeError(f"ENCRYPTION_KEY noto'g'ri: {e}") from e
    return Fernet(key)


def encrypt_text(plaintext: str) -> str:
    """Matnni shifrlash (passport raqami, telefon va h.k.)."""
    fernet = _get_fernet()
    return fernet.encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt_text(ciphertext: str) -> str:
    """Shifrlangan matnni qaytarish."""
    fernet = _get_fernet()
    return fernet.decrypt(ciphertext.encode("ascii")).decode("utf-8")


# ============================================
# Random codes (handoff codes, OTP)
# ============================================
def generate_handoff_code(length: int = 6) -> str:
    """6-raqamli handoff kod yaratish.

    Misol: '328401'
    """
    import secrets

    return "".join(secrets.choice("0123456789") for _ in range(length))


def generate_short_code(length: int = 8) -> str:
    """Mahsulot uchun human-readable short kod yaratish.

    Misol: 'A4B7K2X9'
    """
    import secrets

    # I, O, 0, 1 ni chiqarib tashlash (chalkashtirmaslik uchun)
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))
