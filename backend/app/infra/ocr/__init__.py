"""OCR (passport va ticket tanish)."""

from app.infra.ocr.passport import PassportOcrResult, recognize_passport
from app.infra.ocr.ticket import TicketLeg, TicketOcrResult, recognize_ticket

__all__ = [
    "PassportOcrResult",
    "TicketLeg",
    "TicketOcrResult",
    "recognize_passport",
    "recognize_ticket",
]
