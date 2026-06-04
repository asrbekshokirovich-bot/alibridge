"""S3-compatible object storage (Wasabi, Backblaze, MinIO).

Saqlanadigan ma'lumotlar:
- Passport rasmlari (maxfiy — faqat auth orqali beriladi)
- Aviabilet rasmlari
- Intake (qabul) rasmlari
- Dispute evidence rasmlari
- PDF label fayllari

Maxfiy fayllar (passport/ticket/selfie/evidence) public emas — ular
auth'li `GET /uploads/file` endpoint orqali stream qilinadi (nginx /media
ulardan ochiq kirishni rad etadi).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import BinaryIO

import aioboto3
from botocore.config import Config

from app.core.config import settings
from app.core.logger import get_logger

log = get_logger(__name__)


class S3Storage:
    """Async S3 adapter."""

    def __init__(self) -> None:
        self._session = aioboto3.Session()
        self._config = Config(
            signature_version="s3v4",
            retries={"max_attempts": 3, "mode": "standard"},
        )

    async def upload(
        self,
        *,
        file: BinaryIO | bytes,
        key: str,
        content_type: str = "application/octet-stream",
    ) -> str:
        """Faylni S3'ga yuklash.

        Args:
            file: bytes yoki file-like object
            key: S3 ichidagi yo'l (masalan: "passports/uuid.jpg")
            content_type: MIME type

        Returns:
            Public URL (yoki signed URL)
        """
        async with self._session.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
            config=self._config,
            use_ssl=settings.s3_use_ssl,
        ) as s3:
            body = file if isinstance(file, bytes) else file.read()
            await s3.put_object(
                Bucket=settings.s3_bucket,
                Key=key,
                Body=body,
                ContentType=content_type,
            )

            # Tashqi URL — nginx /media/ proxy yoki s3_public_url (agar sozlangan bo'lsa)
            base = settings.s3_public_url.rstrip("/") if settings.s3_public_url else "/media"
            url = f"{base}/{settings.s3_bucket}/{key}"
            log.info("s3_uploaded", key=key, size=len(body))
            return url

    async def generate_key(self, *, prefix: str, extension: str = "jpg") -> str:
        """Unik S3 key yaratish.

        Format: {prefix}/{YYYY-MM}/{uuid}.{ext}
        """
        now = datetime.now(timezone.utc)
        return f"{prefix}/{now:%Y-%m}/{uuid.uuid4()}.{extension}"

    async def download(self, key: str) -> tuple[bytes, str]:
        """Faylni S3'dan o'qish.

        Returns:
            (bytes, content_type)
        """
        async with self._session.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
            config=self._config,
            use_ssl=settings.s3_use_ssl,
        ) as s3:
            obj = await s3.get_object(Bucket=settings.s3_bucket, Key=key)
            body = await obj["Body"].read()
            content_type = obj.get("ContentType", "application/octet-stream")
            return body, content_type

    async def get_signed_url(self, key: str, *, expires_in: int = 3600) -> str:
        """Signed URL yaratish (vaqtinchalik kirish)."""
        async with self._session.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
        ) as s3:
            return await s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": settings.s3_bucket, "Key": key},
                ExpiresIn=expires_in,
            )

    async def delete(self, key: str) -> None:
        """Faylni o'chirish."""
        async with self._session.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
        ) as s3:
            await s3.delete_object(Bucket=settings.s3_bucket, Key=key)
            log.info("s3_deleted", key=key)


# Singleton
_storage: S3Storage | None = None


def get_storage() -> S3Storage:
    """Storage singleton."""
    global _storage
    if _storage is None:
        _storage = S3Storage()
    return _storage
