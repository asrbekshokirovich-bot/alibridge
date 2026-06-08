"""Barkod (ALB-NNNNNN) generatsiya va Code-128 PDF yorliq.

Kontrakt PDF dizayni (har nusxa):
    ┌──────────────────────┐
    │  Krasovka Nike       │  ← name (tepada)
    │  06.06.2026          │  ← received_date
    │  ║║│║║││║║│║║││║║│    │  ← Code-128 shtrix-kod
    │  ALB-100001          │  ← barcode kod
    └──────────────────────┘
"""

from datetime import date
from io import BytesIO

from barcode import Code128
from barcode.writer import ImageWriter
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

# Yorliq o'lchami (mm) — standart 58x40 termo printer yorlig'i
LABEL_W = 58 * mm
LABEL_H = 40 * mm


def format_barcode(number: int) -> str:
    """100001 -> 'ALB-100001'."""
    return f"ALB-{number}"


def _barcode_png(code: str) -> BytesIO:
    """Code-128 shtrix-kodni PNG sifatida qaytaradi (matnsiz — matnni biz qo'shamiz)."""
    buf = BytesIO()
    writer = ImageWriter()
    Code128(code, writer=writer).write(
        buf,
        options={
            "write_text": False,
            "module_height": 12.0,
            "quiet_zone": 2.0,
            "dpi": 300,
        },
    )
    buf.seek(0)
    return buf


def render_label_pdf(barcode: str, name: str, received: date) -> bytes:
    """Bitta yorliqni PDF (bytes) sifatida chizadi."""
    from reportlab.lib.utils import ImageReader

    out = BytesIO()
    c = canvas.Canvas(out, pagesize=(LABEL_W, LABEL_H))

    # Nom (tepada, qalin, KATTA) — joyga moslab shrift hajmi tanlanadi
    name_text = name if len(name) <= 18 else name[:17] + "…"
    name_size = 27
    while (
        name_size > 12 and c.stringWidth(name_text, "Helvetica-Bold", name_size) > LABEL_W - 6 * mm
    ):
        name_size -= 1
    c.setFont("Helvetica-Bold", name_size)
    c.drawCentredString(LABEL_W / 2, LABEL_H - 8 * mm, name_text)

    # Sana (nomdan pastroqda, kattaroq)
    c.setFont("Helvetica", 12)
    c.drawCentredString(LABEL_W / 2, LABEL_H - 16 * mm, received.strftime("%d.%m.%Y"))

    # Shtrix-kod (markazda)
    png = _barcode_png(barcode)
    img = ImageReader(png)
    bw = LABEL_W - 8 * mm
    bh = 12 * mm
    c.drawImage(
        img,
        (LABEL_W - bw) / 2,
        9.5 * mm,
        width=bw,
        height=bh,
        preserveAspectRatio=False,
        mask="auto",
    )

    # Barkod kodi (pastda)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(LABEL_W / 2, 3.5 * mm, barcode)

    c.showPage()
    c.save()
    return out.getvalue()
