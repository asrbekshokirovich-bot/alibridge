"""Passport OCR — PassportEye (MRZ tanish).

MRZ = Machine Readable Zone — passportning quyi qismidagi 2 yoki 3 qator.
PassportEye checksum bilan tasdiqlaydi — soxta passport ma'lumotlari rad etiladi.

Foydalanish:
    result = await recognize_passport(image_bytes)
    if result.valid:
        print(result.passport_number, result.expires_on)
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from io import BytesIO

from app.core.exceptions import OcrError
from app.core.logger import get_logger

log = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class PassportOcrResult:
    """Passport OCR natijasi."""

    valid: bool
    passport_number: str
    country: str  # ISO 3166-1 alpha-3 (UZB, RUS, ...)
    surname: str
    given_names: str
    nationality: str
    date_of_birth: date | None
    sex: str  # M / F
    expires_on: date | None
    mrz_type: str  # TD1, TD2, TD3

    raw_mrz: str  # debug uchun


async def recognize_passport(image_bytes: bytes) -> PassportOcrResult:
    """Passport rasmidan MRZ ma'lumotlarini chiqarish.

    Args:
        image_bytes: passport bio-page rasmining bayt'lari

    Returns:
        PassportOcrResult — valid=False bo'lsa, ma'lumotlar to'liq emas.

    Raises:
        OcrError: PassportEye ishlamadi
    """
    try:
        # PassportEye sync — keyinroq async wrapper qilamiz
        from passporteye import read_mrz

        # PassportEye fayl yo'lini kutadi yoki BytesIO
        mrz = read_mrz(BytesIO(image_bytes))

        if mrz is None:
            log.warning("passport_mrz_not_found")
            return PassportOcrResult(
                valid=False,
                passport_number="",
                country="",
                surname="",
                given_names="",
                nationality="",
                date_of_birth=None,
                sex="",
                expires_on=None,
                mrz_type="",
                raw_mrz="",
            )

        data = mrz.to_dict()

        # Checksum tekshiruvi (PassportEye o'zi qiladi)
        is_valid = data.get("valid_number", False) and data.get("valid_date_of_birth", False)

        return PassportOcrResult(
            valid=is_valid,
            passport_number=data.get("number", "").strip(),
            country=data.get("country", "").strip(),
            surname=data.get("surname", "").strip(),
            given_names=data.get("names", "").strip(),
            nationality=data.get("nationality", "").strip(),
            date_of_birth=_parse_yymmdd(data.get("date_of_birth")),
            sex=data.get("sex", "").strip(),
            expires_on=_parse_yymmdd(data.get("expiration_date")),
            mrz_type=data.get("type", "").strip(),
            raw_mrz=str(mrz.mrz_code) if hasattr(mrz, "mrz_code") else "",
        )
    except OcrError:
        raise
    except Exception as e:
        log.exception("passport_ocr_failed")
        raise OcrError(
            message="Passport rasmini tanib bo'lmadi",
            details={"error": str(e)},
        ) from e


def _parse_yymmdd(value: str | None) -> date | None:
    """MRZ YYMMDD formatini date'ga aylantirish.

    YY 00-49 → 20YY, YY 50-99 → 19YY (passport uchun amaliy)
    """
    if not value or len(value) != 6:
        return None
    try:
        yy = int(value[0:2])
        mm = int(value[2:4])
        dd = int(value[4:6])
        year = 2000 + yy if yy < 50 else 1900 + yy
        return date(year, mm, dd)
    except (ValueError, IndexError):
        return None
