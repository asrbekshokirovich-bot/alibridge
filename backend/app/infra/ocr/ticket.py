"""Aviabilet OCR — Google Cloud Vision.

Ticket rasmidan parvoz ma'lumotlari ajratib olinadi:
- Flight number
- Departure airport (IATA code)
- Arrival airport (IATA code)
- Date/time
- Passenger name

Layover bo'lsa, barcha legs (segmentlar) qaytariladi.
Carrier o'zining FINAL destination'ini tanlaydi (D3).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime

from app.core.config import settings
from app.core.exceptions import OcrError
from app.core.logger import get_logger

log = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class TicketLeg:
    """Bitta uchish segmenti."""

    flight_number: str
    depart_iata: str
    arrive_iata: str
    depart_at: datetime | None
    arrive_at: datetime | None
    airline: str | None = None


@dataclass(frozen=True, slots=True)
class TicketOcrResult:
    """Ticket OCR natijasi."""

    valid: bool
    passenger_name: str
    legs: list[TicketLeg] = field(default_factory=list)
    raw_text: str = ""


# IATA code regex (3 ta katta harf)
IATA_RE = re.compile(r"\b[A-Z]{3}\b")
# Flight number regex (2 harf + 1-4 raqam, masalan: HY701, TK 1245)
FLIGHT_RE = re.compile(r"\b([A-Z]{2})\s*(\d{1,4})\b")


async def recognize_ticket(image_bytes: bytes) -> TicketOcrResult:
    """Ticket rasmidan parvoz ma'lumotlarini chiqarish.

    Google Cloud Vision Document Text Detection ishlatadi.

    Args:
        image_bytes: ticket rasmining bayt'lari

    Returns:
        TicketOcrResult — legs[] bo'sh bo'lsa OCR muvaffaqiyatsiz.

    Raises:
        OcrError: Vision API ishlamadi yoki credentials yo'q
    """
    if not settings.google_vision_credentials_path:
        raise OcrError(
            message="Google Vision credentials sozlanmagan",
            details={"hint": "GOOGLE_VISION_CREDENTIALS_PATH .env'da kerak"},
        )

    try:
        # Bu yerda Google Vision API chaqiriladi (sync → async wrapper)
        # from google.cloud import vision_v1
        # client = vision_v1.ImageAnnotatorClient.from_service_account_json(...)
        # response = client.document_text_detection(image=vision_v1.Image(content=image_bytes))
        # raw_text = response.full_text_annotation.text

        # Stub: production'da yuqoridagi kod ishlaydi
        raw_text = ""  # placeholder

        legs = _parse_legs(raw_text)
        passenger = _parse_passenger_name(raw_text)

        return TicketOcrResult(
            valid=bool(legs and passenger),
            passenger_name=passenger,
            legs=legs,
            raw_text=raw_text,
        )

    except OcrError:
        raise
    except Exception as e:
        log.exception("ticket_ocr_failed")
        raise OcrError(
            message="Ticketni tanib bo'lmadi",
            details={"error": str(e)},
        ) from e


def _parse_legs(raw_text: str) -> list[TicketLeg]:
    """Ticket matnidan uchish segmentlarini ajratish.

    Bu juda murakkab parsing — har xil ticket formatlari bor.
    Bu yerda asosiy regex'lar; production'da yaxshilanish kerak.
    """
    legs: list[TicketLeg] = []

    lines = raw_text.split("\n")
    for line in lines:
        iatas = IATA_RE.findall(line)
        flights = FLIGHT_RE.findall(line)

        if len(iatas) >= 2 and flights:
            airline_code, flight_num = flights[0]
            legs.append(
                TicketLeg(
                    flight_number=f"{airline_code}{flight_num}",
                    depart_iata=iatas[0],
                    arrive_iata=iatas[1],
                    depart_at=None,
                    arrive_at=None,
                    airline=airline_code,
                )
            )

    return legs


def _parse_passenger_name(raw_text: str) -> str:
    """Yo'lovchi ismini topish.

    "PASSENGER NAME" yoki "NAME OF PASSENGER" so'zlaridan keyin keladi.
    """
    name_patterns = [
        r"PASSENGER\s*NAME\s*[:\-]?\s*([A-Z][A-Z\s/]+)",
        r"NAME\s*OF\s*PASSENGER\s*[:\-]?\s*([A-Z][A-Z\s/]+)",
        r"PAX\s*[:\-]?\s*([A-Z][A-Z\s/]+)",
    ]

    for pattern in name_patterns:
        match = re.search(pattern, raw_text, re.IGNORECASE)
        if match:
            return match.group(1).strip().replace("/", " ")

    return ""
