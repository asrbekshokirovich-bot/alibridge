"""China worker endpoints — sourcing va Tashkentga jo'natish.

  GET  /china/stats                           — dashboard statistikasi
  GET  /china/tickets                         — ochiq sourcing ticketlar
  POST /china/tickets/{order_line_id}/source  — mahsulot sotib olish (Product yaratish)
  GET  /china/shipments                       — mening jo'natmalarim (tayyor + yo'lda)
  POST /china/shipments/ship                  — jo'natildi deb belgilash
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_role
from app.api.deps.db import get_db_session
from app.core.config import settings
from app.domain.enums import FulfillmentStatus, ProductStatus, Role
from app.infra.db.models.order import OrderLine
from app.infra.db.models.product import Product
from app.infra.db.models.user import User
from app.infra.qr.signer import QrSigner
from app.repositories.china_repo import ChinaSourcingRepository
from app.services.china_sourcing import ChinaSourcingService

router = APIRouter()


def _service(session: AsyncSession) -> ChinaSourcingService:
    return ChinaSourcingService(
        session, qr_signer=QrSigner(secret=settings.qr_hmac_secret)
    )


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def china_stats(
    current_user: User = Depends(require_role(Role.CHINA_WORKER)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Dashboard: ochiq ticketlar, jo'natishga tayyor, yo'lda."""
    open_tickets = (
        await session.execute(
            select(func.count(OrderLine.id)).where(
                OrderLine.fulfillment_status
                == FulfillmentStatus.PENDING_SOURCING.value
            )
        )
    ).scalar_one()
    ready = (
        await session.execute(
            select(func.count(Product.id)).where(
                Product.custody_holder_id == current_user.id,
                Product.status == ProductStatus.READY_AT_CHINA.value,
            )
        )
    ).scalar_one()
    in_transit = (
        await session.execute(
            select(func.count(Product.id)).where(
                Product.custody_holder_id == current_user.id,
                Product.status == ProductStatus.IN_TRANSIT_CN_UZ.value,
            )
        )
    ).scalar_one()
    return {
        "open_tickets": open_tickets,
        "ready_to_ship": ready,
        "in_transit": in_transit,
    }


# ── Tickets ───────────────────────────────────────────────────────────────────

@router.get("/tickets")
async def china_tickets(
    current_user: User = Depends(require_role(Role.CHINA_WORKER)),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Ochiq sourcing ticketlar (PENDING_SOURCING)."""
    repo = ChinaSourcingRepository(session)
    return await repo.get_open_tickets()


class SourceRequest(BaseModel):
    count: int
    unit_weight_g: int
    color: str | None = None
    # Quti (box) rejimi: berilsa, har Product = 1 quti, ichida box_items_count dona
    box_items_count: int | None = None


@router.post("/tickets/{order_line_id}/source")
async def china_source(
    order_line_id: uuid.UUID,
    body: SourceRequest,
    current_user: User = Depends(require_role(Role.CHINA_WORKER)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Sourcing ticket'ni bajarish — mahsulot sotib olish (Product yaratish).

    Dona rejimi: count = dona soni, unit_weight_g = bir dona og'irligi.
    Quti rejimi: count = quti soni, unit_weight_g = bir quti og'irligi,
                 box_items_count = bir qutidagi dona soni.
    """
    products = await _service(session).source_ticket(
        order_line_id=order_line_id,
        china_user_id=current_user.id,
        count=body.count,
        unit_weight_g=body.unit_weight_g,
        color=body.color,
        box_items_count=body.box_items_count,
    )
    await session.commit()
    return {
        "created": len(products),
        "product_ids": [str(p.id) for p in products],
    }


# ── Shipments ───────────────────────────────────────────────────────────────────

@router.get("/shipments")
async def china_shipments(
    current_user: User = Depends(require_role(Role.CHINA_WORKER)),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Mening jo'natmalarim (READY_AT_CHINA + IN_TRANSIT_CN_UZ)."""
    repo = ChinaSourcingRepository(session)
    return await repo.get_my_shipments(current_user.id)


class ShipRequest(BaseModel):
    product_ids: list[uuid.UUID]


@router.post("/shipments/ship")
async def china_ship(
    body: ShipRequest,
    current_user: User = Depends(require_role(Role.CHINA_WORKER)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Mahsulotlarni jo'natildi deb belgilash: CHINA_SUPPLIER → IN_TRANSIT_CN_UZ."""
    shipped = await _service(session).mark_shipped(
        product_ids=body.product_ids,
        china_user_id=current_user.id,
    )
    await session.commit()
    return {"shipped": len(shipped)}
