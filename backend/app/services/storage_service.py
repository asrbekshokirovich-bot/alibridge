import io
import uuid

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from PIL import Image, UnidentifiedImageError

from app.core.config import settings
from app.core.errors import AppError

# Rasmni siqishdan oldingi maksimal o'lcham (px) — joy tejash uchun
MAX_DIMENSION = 1280
# JPEG sifati (1-95) — 82 yaxshi balans
JPEG_QUALITY = 82

_client = None


def _get_client():
    """S3 klientini bir marta yaratadi (Supabase Storage / MinIO mos)."""
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            region_name=settings.s3_region,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            use_ssl=settings.s3_use_ssl,
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        )
    return _client


def _compress_to_jpeg(raw: bytes) -> bytes:
    """Rasmni JPEG'ga siqadi: kattaligini kichraytiradi, sifatni pasaytiradi.

    Telefon surati 3-5 MB bo'lsa ham, natija odatda ~0.3-0.5 MB bo'ladi.
    """
    try:
        img = Image.open(io.BytesIO(raw))
        img = img.convert("RGB")  # PNG/HEIC alfa kanalini olib tashlaydi
    except (UnidentifiedImageError, OSError) as exc:
        raise AppError("INVALID_IMAGE", "Rasm fayli buzuq yoki qo'llab-quvvatlanmaydi") from exc

    img.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return out.getvalue()


def _public_url(key: str) -> str:
    base = settings.s3_public_url.rstrip("/")
    if base:
        return f"{base}/{key}"
    # fallback — endpoint orqali
    return f"{settings.s3_endpoint.rstrip('/')}/{settings.s3_bucket}/{key}"


async def upload_product_image(raw: bytes, product_id: int) -> str:
    """Mahsulot rasmini siqib Supabase Storage'ga yuklaydi, public URL qaytaradi."""
    if not settings.s3_enabled:
        raise AppError(
            "STORAGE_NOT_CONFIGURED",
            "Rasm saqlash sozlanmagan (S3 kalitlari yo'q)",
            status_code=503,
        )

    compressed = _compress_to_jpeg(raw)
    key = f"products/{product_id}/{uuid.uuid4().hex}.jpg"

    try:
        _get_client().put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=compressed,
            ContentType="image/jpeg",
            CacheControl="public, max-age=31536000",
        )
    except (BotoCoreError, ClientError) as exc:
        raise AppError(
            "UPLOAD_FAILED", "Rasm yuklashda xatolik yuz berdi", status_code=502
        ) from exc

    return _public_url(key)
