"""
Warehouse TR endpoints — Turciyadagi ombor xodimi uchun.

  GET  /warehouse/tr/stats                    — dashboard statistikasi
  GET  /warehouse/tr/ready                    — mijoz qabul uchun tayyor mahsulotlar
  POST /warehouse/tr/customer-pickup/{id}     — mijoz o'zi kelib olganini belgilash (→ DELIVERED)

Zanjirning oxirgi qadami: mijoz Turkiyadagi omborga o'zi kelib yukini oladi.
Barcha endpoint'lar WAREHOUSE_TR roli talab qiladi.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_role
from app.api.deps.db import get_db_session
from app.domain.enums import CustodyEventType, HandoffStatus, HolderType, ProductStatus, Role
from app.infra.db.models.carrier import CarrierPick, CarrierProfile
from app.infra.db.models.custody import CustodyEvent
from app.infra.db.models.order import Order, OrderLine, SourcingSpec
from app.infra.db.models.product import Product
from app.infra.db.models.user import User

router = APIRouter()


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def warehouse_tr_stats(
    _: User = Depends(require_role(Role.WAREHOUSE_TR)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """TR ombor dashboard statistikasi."""
    in_wh = (await session.execute(
        select(func.count(Product.id)).where(
            Product.status == ProductStatus.AT_TR_WH.value,
        )
    )).scalar_one()

    ready_for_courier = (await session.execute(
        select(func.count(Product.id)).where(
            Product.status == ProductStatus.AT_TR_WH.value,
            Product.custody_holder_type == HolderType.TR_WH.value,
        )
    )).scalar_one()

    from datetime import date
    today = date.today()
    arriving_today = (await session.execute(
        select(func.count(CarrierProfile.user_id.distinct())).where(
            func.date(CarrierProfile.arrive_at) == today,
            CarrierProfile.landing_reported_at.is_(None),
        )
    )).scalar_one()

    return {
        "arriving_today": arriving_today,
        "in_warehouse": in_wh,
        "ready_for_pickup": ready_for_courier,
    }


# ── Ready products ────────────────────────────────────────────────────────────

@router.get("/ready")
async def ready_for_handoff(
    _: User = Depends(require_role(Role.WAREHOUSE_TR)),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Kuryer uchun tayyor mahsulotlar ro'yxati."""
    stmt = (
        select(
            Product,
            SourcingSpec.title.label("spec_title"),
            User.full_name.label("orderer_name"),
        )
        .outerjoin(SourcingSpec, Product.sourcing_spec_id == SourcingSpec.id)
        .outerjoin(OrderLine, Product.order_line_id == OrderLine.id)
        .outerjoin(Order, OrderLine.order_id == Order.id)
        .outerjoin(User, Order.orderer_user_id == User.id)
        .where(Product.status == ProductStatus.AT_TR_WH.value)
        .order_by(Product.created_at.asc())
    )
    rows = (await session.execute(stmt)).all()
    return [
        {
            "id": str(p.id),
            "short_code": p.short_code,
            "spec_title": spec_title or "Noma'lum",
            "orderer_name": orderer_name or "Noma'lum",
            "courier_name": None,
        }
        for p, spec_title, orderer_name in rows
    ]


# ── Customer Pickup ───────────────────────────────────────────────────────────
# Mijoz Turkiyadagi omborga o'zi kelib yukini oladi.
# Status: AT_TR_WH → DELIVERED
# CustodyEvent: DELIVERED_TO_ORDERER

class QrPickupRequest(BaseModel):
    qr_payload: str


@router.post("/customer-pickup-qr")
async def customer_pickup_by_qr(
    body: QrPickupRequest,
    current_user: User = Depends(require_role(Role.WAREHOUSE_TR)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """QR orqali mijozga yuk topshirish (AT_TR_WH → DELIVERED)."""
    from app.infra.qr.signer import InvalidQrPayloadError, QrSigner
    from app.core.config import settings

    signer = QrSigner(secret=settings.qr_hmac_secret)
    try:
        product_id = signer.decode(body.qr_payload)
    except InvalidQrPayloadError:
        raise HTTPException(status_code=400, detail="Noto'g'ri QR kod")

    product = await session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")
    if product.status != ProductStatus.AT_TR_WH.value:
        raise HTTPException(
            status_code=400,
            detail=f"Mahsulot omborда emas (holati: {product.status})",
        )

    old_holder_id = product.custody_holder_id
    product.status = ProductStatus.DELIVERED.value
    product.custody_holder_type = HolderType.ORDERER.value
    product.custody_holder_id = None

    session.add(CustodyEvent(
        id=uuid.uuid4(),
        product_id=product.id,
        event_type=CustodyEventType.DELIVERED_TO_ORDERER.value,
        from_holder_type=HolderType.TR_WH.value,
        from_holder_id=old_holder_id,
        to_holder_type=HolderType.ORDERER.value,
        to_holder_id=None,
        actor_user_id=current_user.id,
    ))
    await session.commit()

    return {"status": "delivered", "short_code": product.short_code, "product_id": str(product.id)}


@router.post("/customer-pickup/{product_id}")
async def customer_pickup(
    product_id: str,
    current_user: User = Depends(require_role(Role.WAREHOUSE_TR)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Mijoz omborga kelib yukini o'zi oldi — DELIVERED deb belgilash.

    Zanjirning oxirgi qadami:
      AT_TR_WH → DELIVERED
    """
    try:
        pid = uuid.UUID(product_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Noto'g'ri product_id")

    product = await session.get(Product, pid)
    if not product:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")
    if product.status != ProductStatus.AT_TR_WH.value:
        raise HTTPException(
            status_code=400,
            detail=f"Mahsulot omborда emas (holati: {product.status})",
        )

    old_holder_id = product.custody_holder_id
    product.status = ProductStatus.DELIVERED.value
    product.custody_holder_type = HolderType.ORDERER.value
    product.custody_holder_id = None

    session.add(CustodyEvent(
        id=uuid.uuid4(),
        product_id=product.id,
        event_type=CustodyEventType.DELIVERED_TO_ORDERER.value,
        from_holder_type=HolderType.TR_WH.value,
        from_holder_id=old_holder_id,
        to_holder_type=HolderType.ORDERER.value,
        to_holder_id=None,
        actor_user_id=current_user.id,
    ))
    await session.commit()

    return {
        "status": "delivered",
        "short_code": product.short_code,
        "product_id": str(product.id),
    }
