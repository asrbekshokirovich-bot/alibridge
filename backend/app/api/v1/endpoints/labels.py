from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.barcode import render_label_docx
from app.core.errors import AppError
from app.db.base import get_db
from app.services.custody_service import get_product_by_barcode

router = APIRouter(tags=["labels"])

_DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


@router.get("/labels/{barcode}.docx")
async def label_docx(
    barcode: str,
    db: AsyncSession = Depends(get_db),
    print_date: str | None = Query(default=None, description="Chop etish sanasi (YYYY-MM-DD). Berilmasa received_date ishlatiladi."),
) -> Response:
    """Word (.docx) yorliq — yuklab olib chop etiladi. Auth talab qilmaydi (print_url)."""
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
        docx = render_label_docx(barcode, barcode, override or date.today())
        return Response(
            content=docx,
            media_type=_DOCX_MIME,
            headers={"Content-Disposition": f'attachment; filename="{barcode}.docx"'},
        )

    label_date = override if override else product.received_date
    docx = render_label_docx(product.barcode, product.name, label_date)
    return Response(
        content=docx,
        media_type=_DOCX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{barcode}.docx"'},
    )
