"""Upload endpoint — rasm yuklash (passport, ticket, intake).

Xavfsizlik qatlamlari:
1. Category whitelist tekshiruvi
2. Content-Type header tekshiruvi (birinchi himoya)
3. Content-Length oldindan cheklash
4. Pillow magic-bytes tekshiruvi (asosiy himoya — header aldab bo'lmaydi)
5. Extension — fayl nomidan emas, Pillow'dan olinadi (path traversal yo'q)
"""

from __future__ import annotations

from io import BytesIO

from fastapi import APIRouter, Depends, File, Query, UploadFile
from PIL import Image
from pydantic import BaseModel

from app.api.deps.auth import get_current_user
from app.core.exceptions import ValidationError
from app.infra.db.models.user import User
from app.infra.storage import get_storage

router = APIRouter()

# Ruxsat etilgan content type'lar (HTTP header bo'yicha birinchi filtr)
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}

# Pillow format → extension xaritasi
PILLOW_FORMAT_MAP = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}

# Max o'lcham: 5 MB (10→5 ga kamaytirildi, RAM himoyasi)
MAX_FILE_SIZE = 5 * 1024 * 1024

# Upload kategoriyalari whitelist
UPLOAD_CATEGORIES = {"passport", "ticket", "selfie", "intake", "evidence"}


class UploadResponse(BaseModel):
    url: str
    key: str
    size: int


@router.post("", response_model=UploadResponse)
async def upload_image(
    file: UploadFile = File(...),
    category: str = Query(..., description="passport | ticket | selfie | intake | evidence"),
    user: User = Depends(get_current_user),
) -> UploadResponse:
    """Rasm yuklash.

    Categories:
    - passport — carrier passport bio-page
    - ticket   — aviabilet
    - selfie   — carrier selfie
    - intake   — Tashkent intake rasmi
    - evidence — dispute evidence
    """
    # 1. Kategoriya whitelist
    if category not in UPLOAD_CATEGORIES:
        raise ValidationError(message=f"Kategoriya yaroqsiz: {category}")

    # 2. Content-Type header (birinchi filtr — yetarli emas yolg'iz)
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise ValidationError(
            message=f"Faqat rasm fayllar qabul qilinadi: jpeg, png, webp"
        )

    # 3. Content-Length oldindan tekshirish (mavjud bo'lsa)
    if file.size is not None and file.size > MAX_FILE_SIZE:
        raise ValidationError(
            message=f"Fayl juda katta (max {MAX_FILE_SIZE // 1024 // 1024} MB)"
        )

    # 4. Faylni o'qish
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise ValidationError(
            message=f"Fayl juda katta (max {MAX_FILE_SIZE // 1024 // 1024} MB)"
        )

    # 5. Pillow bilan magic bytes tekshiruvi (ASOSIY HIMOYA)
    # Bu Content-Type header aldab yuborilsa ham ishlaydi
    try:
        img = Image.open(BytesIO(content))
        img.verify()  # tampered yoki buzilgan faylda exception chiqaradi
        actual_format = img.format  # "JPEG", "PNG", "WEBP"
    except Exception:
        raise ValidationError(message="Rasm fayl emas yoki buzilgan")

    if actual_format not in PILLOW_FORMAT_MAP:
        raise ValidationError(
            message=f"Qo'llab-quvvatlanmaydigan rasm formati: {actual_format}"
        )

    # 6. Extension — fayl nomidan emas, Pillow formatidan (path traversal himoyasi)
    extension = PILLOW_FORMAT_MAP[actual_format]

    # 7. Saqlash
    storage = get_storage()
    key = await storage.generate_key(prefix=category, extension=extension)
    url = await storage.upload(
        file=content,
        key=key,
        content_type=file.content_type,
    )

    return UploadResponse(url=url, key=key, size=len(content))
