"""QR payload imzolash (HMAC-SHA256).

DEV_PLAN §7.2 dan:
    payload = base64url( product_id_bytes(16) || hmac_sha256(secret, product_id_bytes)[:8] )

Bu nima beradi:
- Skaner QR'ni o'qiganda, signature tekshiriladi
- Soxta yoki tampered QR'lar darhol rad etiladi
- Random QR ham ishlamaydi
- Payload ~32 belgi (kichik)

Misol:
    signer = QrSigner(secret=settings.qr_hmac_secret)
    payload = signer.encode(product_id)
    # → "AbCdEf...XyZ" (32 ta belgi)

    product_id = signer.decode(payload)  # tekshiradi va qaytaradi
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import uuid
from io import BytesIO

import qrcode
from qrcode.image.pil import PilImage

from app.core.exceptions import AppException


class InvalidQrPayloadError(AppException):
    """QR payload imzosi yaroqsiz yoki tampered."""

    status_code = 400
    error_code = "invalid_qr_payload"
    message = "QR kod yaroqsiz yoki o'zgartirilgan"


# Signature uzunligi (bytes) — yangi QR'lar 16 bayt (128-bit)
SIGNATURE_LENGTH = 16
# Eski QR'lar 8 bayt (64-bit) bilan imzolangan — orqaga moslik uchun qabul qilinadi
_LEGACY_SIGNATURE_LENGTH = 8
PRODUCT_ID_LENGTH = 16


class QrSigner:
    """HMAC-SHA256 bilan imzolanadigan QR payload generator.

    Secret kalit `.env` ichida saqlanadi (QR_HMAC_SECRET).
    Bu kalit production'da random 64-byte hex bo'lishi shart.
    """

    def __init__(self, secret: str) -> None:
        if len(secret) < 32:
            raise ValueError("QR HMAC secret kamida 32 belgi bo'lishi shart")
        self._secret = secret.encode("utf-8")

    # ============================================
    # Encode
    # ============================================
    def encode(self, product_id: uuid.UUID) -> str:
        """Product ID ni imzolangan QR payload'ga o'tkazish.

        Format: base64url(uuid_bytes + hmac[:8])
        Natija: ~32 belgi
        """
        product_bytes = product_id.bytes  # 16 bytes
        signature = self._sign(product_bytes, SIGNATURE_LENGTH)

        combined = product_bytes + signature
        return base64.urlsafe_b64encode(combined).decode("ascii").rstrip("=")

    # ============================================
    # Decode + verify
    # ============================================
    def decode(self, payload: str) -> uuid.UUID:
        """QR payload'ni dekodlash va imzosini tekshirish.

        Raises:
            InvalidQrPayloadError: yaroqsiz format yoki noto'g'ri imzo
        """
        try:
            # Padding qo'shish (base64 talab qiladi)
            padded = payload + "=" * (-len(payload) % 4)
            combined = base64.urlsafe_b64decode(padded)
        except Exception as e:
            raise InvalidQrPayloadError(
                message="QR formati noto'g'ri",
                details={"reason": str(e)},
            ) from e

        # Yangi (16 bayt) yoki eski (8 bayt) imzo uzunligini aniqlash
        sig_len: int
        if len(combined) == PRODUCT_ID_LENGTH + SIGNATURE_LENGTH:
            sig_len = SIGNATURE_LENGTH
        elif len(combined) == PRODUCT_ID_LENGTH + _LEGACY_SIGNATURE_LENGTH:
            sig_len = _LEGACY_SIGNATURE_LENGTH
        else:
            raise InvalidQrPayloadError(
                message="QR payload uzunligi noto'g'ri",
                details={
                    "expected": [
                        PRODUCT_ID_LENGTH + SIGNATURE_LENGTH,
                        PRODUCT_ID_LENGTH + _LEGACY_SIGNATURE_LENGTH,
                    ],
                    "got": len(combined),
                },
            )

        product_bytes = combined[:PRODUCT_ID_LENGTH]
        signature = combined[PRODUCT_ID_LENGTH:]

        # Imzoni tekshirish (mos uzunlik bilan)
        expected = self._sign(product_bytes, sig_len)
        if not hmac.compare_digest(signature, expected):
            raise InvalidQrPayloadError(message="QR imzosi yaroqsiz")

        return uuid.UUID(bytes=product_bytes)

    # ============================================
    # Internal
    # ============================================
    def _sign(self, data: bytes, length: int = SIGNATURE_LENGTH) -> bytes:
        """HMAC-SHA256 imzosi (birinchi `length` byte)."""
        mac = hmac.new(self._secret, data, hashlib.sha256)
        return mac.digest()[:length]


# ============================================
# QR image generation (PNG)
# ============================================
def generate_qr_image(payload: str, *, box_size: int = 10, border: int = 2) -> bytes:
    """QR image (PNG) yaratish.

    Args:
        payload: QR ichidagi matn (signer.encode() natijasi)
        box_size: har bir piksel kvadrat o'lchami
        border: chetidagi bo'sh joy

    Returns:
        PNG bytes
    """
    qr = qrcode.QRCode(
        version=None,  # avtomatik tanlash
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=box_size,
        border=border,
    )
    qr.add_data(payload)
    qr.make(fit=True)

    img: PilImage = qr.make_image(fill_color="black", back_color="white")
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
