"""PDF label generatsiya (ReportLab).

Har bir A4 sahifaga 4 ta yorliq joylashtiriladi (2x2 grid).
Har bir yorliqda:
- QR kod (skanerlash uchun)
- Short code (8 belgili human-readable)
- Barcode (Code-128)
- Product info (nomi, og'irligi)

DEV_PLAN §7.1 — bulk PDF generation < 5s (1000 products).
"""

from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

from reportlab.graphics.barcode.code128 import Code128
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.pdfgen.canvas import Canvas

from app.infra.qr.signer import generate_qr_image


# Sahifa va yorliq o'lchamlari
PAGE_WIDTH, PAGE_HEIGHT = A4
LABELS_PER_ROW = 2
LABELS_PER_COL = 2
LABELS_PER_PAGE = LABELS_PER_ROW * LABELS_PER_COL

# 1cm chetlar
MARGIN = 10 * mm
LABEL_WIDTH = (PAGE_WIDTH - 2 * MARGIN) / LABELS_PER_ROW
LABEL_HEIGHT = (PAGE_HEIGHT - 2 * MARGIN) / LABELS_PER_COL


@dataclass(frozen=True, slots=True)
class LabelData:
    """Bitta yorliq ma'lumotlari."""

    short_code: str
    qr_payload: str
    barcode_payload: str
    product_title: str
    weight_g: int
    color: str | None = None


def generate_labels_pdf(labels: list[LabelData]) -> bytes:
    """Yorliqlar uchun PDF yaratish.

    Args:
        labels: yorliqlar ro'yxati (4 tasi har sahifaga)

    Returns:
        PDF bytes (Telegram'ga document sifatida yuborish uchun)
    """
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)

    for index, label in enumerate(labels):
        # Pozitsiyani hisoblash (page'da)
        pos_in_page = index % LABELS_PER_PAGE
        col = pos_in_page % LABELS_PER_ROW
        row = pos_in_page // LABELS_PER_ROW

        x = MARGIN + col * LABEL_WIDTH
        # Y koordinata pastdan boshlanadi (PDF coord system)
        y = PAGE_HEIGHT - MARGIN - (row + 1) * LABEL_HEIGHT

        _draw_label(pdf, x, y, label)

        # Yangi sahifa boshlash
        if pos_in_page == LABELS_PER_PAGE - 1 and index < len(labels) - 1:
            pdf.showPage()

    pdf.save()
    return buffer.getvalue()


def _draw_label(pdf: Canvas, x: float, y: float, label: LabelData) -> None:
    """Bitta yorliq chizish (x, y — chap pastki burchak)."""
    # Tashqi ramka
    pdf.setLineWidth(0.5)
    pdf.rect(x + 2, y + 2, LABEL_WIDTH - 4, LABEL_HEIGHT - 4)

    # QR — chap tomonda
    qr_size = 35 * mm
    qr_x = x + 5 * mm
    qr_y = y + LABEL_HEIGHT - qr_size - 5 * mm

    qr_png = generate_qr_image(label.qr_payload, box_size=6, border=1)
    from reportlab.lib.utils import ImageReader

    qr_img = ImageReader(BytesIO(qr_png))
    pdf.drawImage(qr_img, qr_x, qr_y, qr_size, qr_size)

    # Short code — QR ostida
    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(qr_x, qr_y - 5 * mm, label.short_code)

    # Mahsulot info — o'ng tomonda
    text_x = x + qr_size + 12 * mm
    text_y = y + LABEL_HEIGHT - 12 * mm

    pdf.setFont("Helvetica-Bold", 11)
    # Title (cut if too long)
    title = label.product_title[:35] + "…" if len(label.product_title) > 35 else label.product_title
    pdf.drawString(text_x, text_y, title)

    pdf.setFont("Helvetica", 9)
    pdf.drawString(text_x, text_y - 6 * mm, f"Og'irligi: {label.weight_g} g")
    if label.color:
        pdf.drawString(text_x, text_y - 11 * mm, f"Rang: {label.color}")

    # Barcode — pastki qismda
    barcode = Code128(
        label.barcode_payload,
        barHeight=12 * mm,
        barWidth=0.35 * mm,
        humanReadable=True,
    )
    barcode.drawOn(pdf, x + 5 * mm, y + 5 * mm)
