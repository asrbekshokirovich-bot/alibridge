"""Barkod (ALB-NNNNNN) generatsiya va Code-128 Word (.docx) yorliq.

Yorliq o'lchami: 50 x 80 mm (eni 50mm, bo'yi 80mm — vertikal/tik termo yorliq).
Dizayn — barcha element ketma-ket, bitta yorliqqa sig'adi:
    ┌──────────────┐
    │   TGHFTH     │  ← name (qalin, katta)
    │  08.06.2026  │  ← sana
    │ ║║│║║││║║│║║  │  ← Code-128 shtrix-kod
    │  ALB-100001  │  ← barcode kod
    └──────────────┘
"""

from datetime import date
from io import BytesIO

from barcode import Code128
from barcode.writer import ImageWriter


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


def render_label_docx(barcode: str, name: str, received: date) -> bytes:
    """Bitta yorliqni Word (.docx) sifatida chizadi — 50x80 mm (eni x bo'yi) tik yorliq.

    4 element ketma-ket, bitta yorliqqa sig'adi:
    nom (qalin, katta) / sana / shtrix-kod / barkod kodi.
    """
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.shared import Mm, Pt

    doc = Document()
    section = doc.sections[0]
    # Aniq yorliq o'lchami: eni 50mm, bo'yi 80mm (vertikal/tik — portrait)
    section.page_width = Mm(50)
    section.page_height = Mm(80)
    section.top_margin = Mm(3)
    section.bottom_margin = Mm(3)
    section.left_margin = Mm(2)
    section.right_margin = Mm(2)

    def _tight(p, after=3.0):
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        pf = p.paragraph_format
        pf.space_before = Pt(0)
        pf.space_after = Pt(after)
        pf.line_spacing = 1.0
        pf.keep_with_next = False
        pf.keep_together = False
        return p

    # Nom (qalin, katta)
    p_name = _tight(doc.add_paragraph(), after=3.0)
    run_name = p_name.add_run(name if len(name) <= 18 else name[:17] + "…")
    run_name.bold = True
    run_name.font.size = Pt(15)

    # Sana
    p_date = _tight(doc.add_paragraph(), after=4.0)
    run_date = p_date.add_run(received.strftime("%d.%m.%Y"))
    run_date.font.size = Pt(11)

    # Shtrix-kod rasmi (eni 46mm — yorliqqa to'liq)
    p_img = _tight(doc.add_paragraph(), after=3.0)
    png = _barcode_png(barcode, module_height=10.0)
    p_img.add_run().add_picture(png, width=Mm(44), height=Mm(18))

    # Barkod kodi (pastda)
    p_code = _tight(doc.add_paragraph(), after=0.0)
    run_code = p_code.add_run(barcode)
    run_code.bold = True
    run_code.font.size = Pt(13)

    out = BytesIO()
    doc.save(out)
    return out.getvalue()
