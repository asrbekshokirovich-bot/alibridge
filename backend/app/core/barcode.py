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


def render_label_docx(barcode: str, name: str, received: date) -> bytes:
    """Bitta yorliqni Word (.docx) sifatida chizadi — oddiy printerda chop etish uchun.

    Tartib (markazlashgan): nom (qalin, katta) / sana / shtrix-kod rasmi / barkod kodi.
    """
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.shared import Mm, Pt

    doc = Document()
    section = doc.sections[0]
    # Yorliq o'lchamiga yaqin sahifa (58x40 mm), minimal hoshiya
    section.page_width = Mm(58)
    section.page_height = Mm(40)
    section.top_margin = Mm(2)
    section.bottom_margin = Mm(2)
    section.left_margin = Mm(3)
    section.right_margin = Mm(3)

    # Nom (qalin, katta)
    p_name = doc.add_paragraph()
    p_name.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_name.paragraph_format.space_after = Pt(2)
    run_name = p_name.add_run(name if len(name) <= 24 else name[:23] + "…")
    run_name.bold = True
    run_name.font.size = Pt(16)

    # Sana
    p_date = doc.add_paragraph()
    p_date.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_date.paragraph_format.space_after = Pt(2)
    run_date = p_date.add_run(received.strftime("%d.%m.%Y"))
    run_date.font.size = Pt(11)

    # Shtrix-kod rasmi (markazda)
    p_img = doc.add_paragraph()
    p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_img.paragraph_format.space_after = Pt(2)
    png = _barcode_png(barcode)
    p_img.add_run().add_picture(png, width=Mm(50))

    # Barkod kodi (pastda)
    p_code = doc.add_paragraph()
    p_code.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_code = p_code.add_run(barcode)
    run_code.bold = True
    run_code.font.size = Pt(11)

    out = BytesIO()
    doc.save(out)
    return out.getvalue()
