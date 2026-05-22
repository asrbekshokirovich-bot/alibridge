"""
Courier endpoints — O'zbekiston va Turkiya kuryerlari uchun.

  GET  /courier/stats              — dashboard statistikasi (ikkala rol)
  POST /courier/pickup             — faqat COURIER_UZ: AT_TASHKENT_WH → WITH_COURIER_UZ
  GET  /courier/queue              — bu kuryer bilan bo'lgan mahsulotlar (ikkala rol)
  POST /courier/deliver/{id}       — yetkazib berish (ikkala rol)

COURIER_UZ:  Ombordan oladi (/courier/pickup) → yo'lovchiga yetkazadi
COURIER_TR:  Yo'lovchidan oladi (/scan + COURIER_TR_RECEIVE) → turkiya omboriga yetkazadi
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_role
from app.api.deps.db import get_db_session
from app.domain.enums import (
    CustodyEventType,
    HolderType,
    ProductStatus,
    Role,
)
from app.infra.db.models.custody import CustodyEvent
from app.infra.db.models.order import SourcingSpec
from app.infra.db.models.product import Product
from app.infra.db.models.user import User

router = APIRouter()

# Ikkala kuryer rolini bitta require_role da qabul qilish
_COURIER_ROLES = (Role.COURIER_UZ, Role.COURIER_TR)


# ── Kuryer kontekstini aniqlash ────────────────────────────────────────────────

@dataclass
class _CourierCtx:
    is_tr: bool
    with_status: str      # mahsulot holati "kuryer qo'lida"
    from_status: str      # pickup uchun zarur holat
    holder_type: str      # HolderType kuryer sifatida
    from_holder_type: str # pickup qilayotganda oldingi holder
    pickup_event: str     # CustodyEventType


def _courier_ctx(current_user: User) -> _CourierCtx:
    """current_user.roles ga qarab kuryer konfiguratsiyasini qaytaradi."""
    user_role_values = {r.role for r in (current_user.roles or [])}
    is_tr = Role.COURIER_TR.value in user_role_values
    if is_tr:
        return _CourierCtx(
            is_tr=True,
            with_status=ProductStatus.WITH_COURIER_TR.value,
            from_status=ProductStatus.AT_TR_WH.value,
            holder_type=HolderType.COURIER_TR.value,
            from_holder_type=HolderType.TR_WH.value,
            pickup_event=CustodyEventType.HANDED_TO_TR_COURIER.value,
        )
    return _CourierCtx(
        is_tr=False,
        with_status=ProductStatus.WITH_COURIER_UZ.value,
        from_status=ProductStatus.AT_TASHKENT_WH.value,
        holder_type=HolderType.COURIER_UZ.value,
        from_holder_type=HolderType.TASHKENT_WH.value,
        pickup_event=CustodyEventType.PICKED_BY_COURIER.value,
    )


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def courier_stats(
    current_user: User = Depends(require_role(*_COURIER_ROLES)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Dashboard statistikasi."""
    ctx = _courier_ctx(current_user)

    with_me = (await session.execute(
        select(func.count(Product.id)).where(
            Product.status == ctx.with_status,
            Product.custody_holder_id == current_user.id,
        )
    )).scalar_one()

    return {
        "pending_pickup": with_me,
        "in_delivery": with_me,
        "delivered_today": 0,
    }


# ── Pickup ────────────────────────────────────────────────────────────────────

class PickupRequest(BaseModel):
    qr_payload: str


@router.post("/pickup")
async def courier_pickup(
    body: PickupRequest,
    current_user: User = Depends(require_role(Role.COURIER_UZ)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """QR skanerlash orqali mahsulotni qabul qilish — faqat COURIER_UZ.

    COURIER_UZ: AT_TASHKENT_WH → WITH_COURIER_UZ
    (COURIER_TR /scan + COURIER_TR_RECEIVE context orqali qabul qiladi)
    """
    from app.infra.qr.signer import InvalidQrPayloadError, QrSigner
    from app.core.config import settings

    # Pickup faqat COURIER_UZ uchun — ctx har doim UZ bo'ladi
    ctx = _courier_ctx(current_user)   # is_tr=False garantiyalangan (require_role COURIER_UZ)

    signer = QrSigner(secret=settings.qr_hmac_secret)
    try:
        product_id = signer.decode(body.qr_payload)
    except InvalidQrPayloadError:
        raise HTTPException(status_code=400, detail="Noto'g'ri QR kod")

    stmt = (
        select(Product, SourcingSpec.title.label("spec_title"))
        .outerjoin(SourcingSpec, Product.sourcing_spec_id == SourcingSpec.id)
        .where(Product.id == product_id)
    )
    row = (await session.execute(stmt)).first()
    if not row:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")

    product, spec_title = row

    if product.status != ctx.from_status:
        raise HTTPException(
            status_code=400,
            detail=f"Mahsulot kutilgan holatda emas (holati: {product.status})",
        )

    old_holder_id = product.custody_holder_id

    product.status = ctx.with_status
    product.custody_holder_type = ctx.holder_type
    product.custody_holder_id = current_user.id

    session.add(CustodyEvent(
        id=uuid.uuid4(),
        product_id=product_id,
        event_type=ctx.pickup_event,
        from_holder_type=ctx.from_holder_type,
        from_holder_id=old_holder_id,
        to_holder_type=ctx.holder_type,
        to_holder_id=current_user.id,
        actor_user_id=current_user.id,
    ))
    await session.commit()

    return {
        "short_code": product.short_code,
        "status": product.status,
        "spec_title": spec_title or "Noma'lum",
    }


# ── Queue ─────────────────────────────────────────────────────────────────────

@router.get("/queue")
async def courier_queue(
    current_user: User = Depends(require_role(*_COURIER_ROLES)),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Bu kuryer bilan bo'lgan mahsulotlar ro'yxati."""
    ctx = _courier_ctx(current_user)

    stmt = (
        select(Product, SourcingSpec.title.label("spec_title"))
        .outerjoin(SourcingSpec, Product.sourcing_spec_id == SourcingSpec.id)
        .where(
            Product.status == ctx.with_status,
            Product.custody_holder_id == current_user.id,
        )
        .order_by(Product.created_at.asc())
    )
    rows = (await session.execute(stmt)).all()

    return [
        {
            "id": str(p.id),
            "short_code": p.short_code,
            "spec_title": spec_title or "Noma'lum",
            "delivery_address": "",
            "recipient_name": "",
            "recipient_phone": "",
            "notes": None,
            "assigned_at": p.created_at.isoformat(),
        }
        for p, spec_title in rows
    ]


# ── Deliver ───────────────────────────────────────────────────────────────────

@router.post("/deliver/{product_id}")
async def deliver_product(
    product_id: str,
    current_user: User = Depends(require_role(*_COURIER_ROLES)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Mahsulotni yetkazildi deb belgilash.

    COURIER_UZ: WITH_COURIER_UZ → DELIVERED
    COURIER_TR: WITH_COURIER_TR → DELIVERED
    """
    ctx = _courier_ctx(current_user)

    product = await session.get(Product, uuid.UUID(product_id))
    if not product:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")
    if product.custody_holder_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bu mahsulot sizda emas")
    if product.status != ctx.with_status:
        raise HTTPException(
            status_code=400,
            detail=f"Mahsulot kuryerda emas (holati: {product.status})",
        )

    product.status = ProductStatus.DELIVERED.value
    product.custody_holder_type = HolderType.ORDERER.value
    product.custody_holder_id = None

    session.add(CustodyEvent(
        id=uuid.uuid4(),
        product_id=product.id,
        event_type=CustodyEventType.DELIVERED_TO_ORDERER.value,
        from_holder_type=ctx.holder_type,
        from_holder_id=current_user.id,
        to_holder_type=HolderType.ORDERER.value,
        to_holder_id=None,
        actor_user_id=current_user.id,
    ))
    await session.commit()

    return {"status": "delivered", "short_code": product.short_code}
