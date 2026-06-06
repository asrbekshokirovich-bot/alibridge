from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.barcode import render_label_pdf
from app.core.errors import AppError
from app.db.base import get_db
from app.services.custody_service import get_product_by_barcode

router = APIRouter(tags=["labels"])


@router.get("/labels/{barcode}.pdf")
async def label_pdf(
    barcode: str,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """PDF yorliq — brauzerda ochiladi/yuklanadi. Auth talab qilmaydi (print_url)."""
    try:
        product = await get_product_by_barcode(db, barcode)
    except AppError:
        # Yorliq uchun aniq mahsulot bo'lmasa ham, faqat barkod bilan chizamiz
        from datetime import date

        pdf = render_label_pdf(barcode, barcode, date.today())
        return Response(content=pdf, media_type="application/pdf")

    pdf = render_label_pdf(product.barcode, product.name, product.received_date)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{barcode}.pdf"'},
    )
