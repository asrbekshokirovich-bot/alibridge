from datetime import date

from fastapi import APIRouter, Depends, Query
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
    print_date: str | None = Query(default=None, description="Chop etish sanasi (YYYY-MM-DD). Berilmasa received_date ishlatiladi."),
) -> Response:
    """PDF yorliq — brauzerda ochiladi/yuklanadi. Auth talab qilmaydi (print_url)."""
    # print_date berilsa o'sha sanani ishlatamiz, aks holda received_date
    override: date | None = None
    if print_date:
        try:
            override = date.fromisoformat(print_date)
        except ValueError:
            override = None

    try:
        product = await get_product_by_barcode(db, barcode)
    except AppError:
        pdf = render_label_pdf(barcode, barcode, override or date.today())
        return Response(content=pdf, media_type="application/pdf")

    label_date = override if override else product.received_date
    pdf = render_label_pdf(product.barcode, product.name, label_date)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{barcode}.pdf"'},
    )
