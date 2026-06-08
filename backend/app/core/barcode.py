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


def _barcode_png(code: str, module_height: float = 12.0) -> BytesIO:
    """Code-128 shtrix-kodni PNG sifatida qaytaradi (matnsiz — matnni biz qo'shamiz)."""
    buf = BytesIO()
    writer = ImageWriter()
    Code128(code, writer=writer).write(
        buf,
        options={
            "write_text": False,
            "module_height": module_height,
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
    # A6 ga yaqin sahifa — barcha element bemalol bitta sahifaga sig'adi
    section.page_width = Mm(70)
    section.page_height = Mm(70)
    section.top_margin = Mm(3)
    section.bottom_margin = Mm(3)
    section.left_margin = Mm(4)
    section.right_margin = Mm(4)

    def _tight(p):
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        pf = p.paragraph_format
        pf.space_before = Pt(0)
        pf.space_after = Pt(2)
        pf.line_spacing = 1.0
        return p

    def _no_keep(p):
        """Paragrafni keyingisi bilan "birga ushlash"ni o'chiramiz — sahifa
        bo'linishiga sabab bo'ladigan keep_with_next/keep_together ni olib tashlaymiz."""
        p.paragraph_format.keep_with_next = False
        p.paragraph_format.keep_together = False
        # bo'sh paragraf qo'shilib ketmasligi uchun
        return p

    # Nom (qalin, katta)
    p_name = _no_keep(_tight(doc.add_paragraph()))
    run_name = p_name.add_run(name if len(name) <= 24 else name[:23] + "…")
    run_name.bold = True
    run_name.font.size = Pt(16)

    # Sana
    p_date = _no_keep(_tight(doc.add_paragraph()))
    run_date = p_date.add_run(received.strftime("%d.%m.%Y"))
    run_date.font.size = Pt(11)

    # Shtrix-kod rasmi — past
    p_img = _no_keep(_tight(doc.add_paragraph()))
    png = _barcode_png(barcode, module_height=8.0)
    p_img.add_run().add_picture(png, width=Mm(55), height=Mm(15))

    # Barkod kodi (pastda) — oxirgi paragraf, space_after = 0
    p_code = _no_keep(_tight(doc.add_paragraph()))
    p_code.paragraph_format.space_after = Pt(0)
    run_code = p_code.add_run(barcode)
    run_code.bold = True
    run_code.font.size = Pt(12)

    out = BytesIO()
    doc.save(out)
    return out.getvalue()
