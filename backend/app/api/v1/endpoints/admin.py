"""Admin endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_role
from app.api.deps.db import get_db_session
from app.domain.enums import PayoutStatus, Role
from app.infra.db.models.carrier import CarrierProfile, CarrierPick
from app.infra.db.models.dispute import Dispute
from app.infra.db.models.order import SourcingSpec
from app.infra.db.models.payout import Payout, PayoutLine
from app.infra.db.models.product import Product
from app.infra.db.models.user import User
from app.repositories.user_repo import UserRepository

router = APIRouter()


# ─── Schemas ────────────────────────────────────────────────────────────────────

class GrantRoleRequest(BaseModel):
    """Faqat role talab qilinadi — user_id path'dan olinadi."""
    role: str


# ─── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    q: str = Query(default="", max_length=100, description="Ismi yoki username bo'yicha qidiruv"),
    admin: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Foydalanuvchilar ro'yxati (ixtiyoriy qidiruv bilan)."""
    repo = UserRepository(session)
    users = await repo.list_users(search=q)
    return [
        {
            "id": str(u.id),
            "telegram_id": str(u.telegram_id),
            "full_name": u.full_name or "",
            "username": u.telegram_username,
            "roles": [r.role for r in u.roles if r.revoked_at is None],
            "language": u.language_code,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]


@router.post("/users/{user_id}/roles", status_code=201)
async def grant_role(
    user_id: uuid.UUID,
    body: GrantRoleRequest,
    admin: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Foydalanuvchiga rol berish (faqat admin)."""
    try:
        role_enum = Role(body.role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Noto'g'ri rol: {body.role}")

    repo = UserRepository(session)
    # Avval user mavjudligini tekshirish
    target = await repo.get_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")

    ur = await repo.grant_role(
        user_id=user_id,
        role=role_enum,
        granted_by_user_id=admin.id,
    )
    await session.commit()
    return {"user_id": str(ur.user_id), "role": ur.role}


@router.delete("/users/{user_id}/roles/{role}", status_code=200)
async def revoke_role(
    user_id: uuid.UUID,
    role: str,
    admin: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Foydalanuvchidan rolni olib tashlash (faqat admin)."""
    repo = UserRepository(session)
    revoked = await repo.revoke_role(user_id=user_id, role=role)
    if not revoked:
        raise HTTPException(status_code=404, detail="Rol topilmadi yoki allaqachon bekor qilingan")
    await session.commit()
    return {"revoked": True, "user_id": str(user_id), "role": role}


# ─── Disputes ───────────────────────────────────────────────────────────────────

@router.get("/disputes")
async def list_disputes(
    status: str = Query(default="OPEN"),
    _: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Ochiq disputlar ro'yxati."""
    stmt = (
        select(Dispute, Product.short_code, User.full_name.label("filed_by_name"))
        .join(Product, Dispute.product_id == Product.id)
        .join(User, Dispute.raised_by_user_id == User.id)
    )
    if status == "OPEN":
        stmt = stmt.where(Dispute.resolved_at.is_(None))
    rows = (await session.execute(stmt)).all()
    return [
        {
            "id": str(d.id),
            "dispute_type": d.type,
            "status": "OPEN" if d.resolved_at is None else "RESOLVED",
            "product_short_code": short_code,
            "carrier_name": filed_by or "Noma'lum",
            "filed_by_name": filed_by or "Noma'lum",
            "filed_at": d.raised_at.isoformat(),
            "description": d.resolution_notes or "",
            "deduction_amount": None,
            "deduction_currency": None,
        }
        for d, short_code, filed_by in rows
    ]


class ResolveDisputeRequest(BaseModel):
    resolution: str          # CARRIER_FAULT | FORCE_MAJEURE | ORDERER_FAULT | SPLIT
    deduction_amount: str | None = None
    notes: str | None = None

    @field_validator("deduction_amount")
    @classmethod
    def deduction_must_be_non_negative(cls, v: str | None) -> str | None:
        if v is not None:
            try:
                if Decimal(v) < 0:
                    raise ValueError("Deduction manfiy bo'lishi mumkin emas")
            except (ValueError, Exception) as e:
                raise ValueError(str(e)) from e
        return v


@router.post("/disputes/{dispute_id}/resolve")
async def resolve_dispute(
    dispute_id: uuid.UUID,
    body: ResolveDisputeRequest,
    admin: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Disputni hal qilish."""
    dispute = await session.get(Dispute, dispute_id)
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute topilmadi")
    if dispute.resolved_at:
        raise HTTPException(status_code=400, detail="Bu dispute allaqachon hal qilingan")
    dispute.resolution = body.resolution
    dispute.resolution_notes = body.notes
    dispute.resolved_by_admin_id = admin.id
    dispute.resolved_at = datetime.now(timezone.utc)
    await session.commit()
    return {"status": "resolved", "resolution": body.resolution}


# ─── Admin Payouts ───────────────────────────────────────────────────────────────

@router.get("/payouts")
async def admin_list_payouts(
    status: str = Query(default="REQUESTED"),
    _: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Payout so'rovlari ro'yxati (admin ko'rishi uchun)."""
    stmt = (
        select(Payout, User.full_name, User.telegram_id)
        .join(CarrierProfile, Payout.carrier_user_id == CarrierProfile.user_id)
        .join(User, CarrierProfile.user_id == User.id)
        .where(Payout.status == status)
        .order_by(Payout.requested_at.asc())
    )
    rows = (await session.execute(stmt)).all()
    result = []
    for payout, carrier_name, tg_id in rows:
        lines = payout.lines  # selectin loaded
        gross = sum(ln.amount for ln in lines) if lines else Decimal("0")
        deductions = sum(ln.deduction for ln in lines) if lines else Decimal("0")
        result.append({
            "id": str(payout.id),
            "carrier_name": carrier_name or "Noma'lum",
            "carrier_telegram_id": str(tg_id),
            "payout_method": payout.method,
            "account_details": payout.payment_reference or "",
            "gross_amount": str(gross),
            "deductions": str(deductions),
            "net_amount": str(gross - deductions),
            "currency": payout.currency,
            "fx_rate_to_usd": str(payout.fx_rate or 1),
            "pick_count": len(lines),
            "requested_at": payout.requested_at.isoformat(),
        })
    return result


@router.post("/payouts/{payout_id}/approve")
async def approve_payout(
    payout_id: uuid.UUID,
    admin: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Payout so'rovini tasdiqlash."""
    payout = await session.get(Payout, payout_id)
    if not payout:
        raise HTTPException(status_code=404, detail="Payout topilmadi")
    if payout.status != PayoutStatus.REQUESTED.value:
        raise HTTPException(status_code=400, detail=f"Payout holati: {payout.status}")
    payout.status = PayoutStatus.APPROVED.value
    payout.approved_at = datetime.now(timezone.utc)
    payout.paid_by_admin_id = admin.id
    await session.commit()
    return {"status": "approved"}


class RejectPayoutRequest(BaseModel):
    reason: str


@router.post("/payouts/{payout_id}/reject")
async def reject_payout(
    payout_id: uuid.UUID,
    body: RejectPayoutRequest,
    _: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Payout so'rovini rad etish."""
    payout = await session.get(Payout, payout_id)
    if not payout:
        raise HTTPException(status_code=404, detail="Payout topilmadi")
    if payout.status != PayoutStatus.REQUESTED.value:
        raise HTTPException(status_code=400, detail=f"Payout holati: {payout.status}")
    payout.status = PayoutStatus.REJECTED.value
    payout.notes = body.reason
    await session.commit()
    return {"status": "rejected"}


# ─── Products ────────────────────────────────────────────────────────────────────

@router.get("/products")
async def list_products(
    q: str = Query(default="", max_length=100, description="short_code yoki nomi bo'yicha qidiruv"),
    status: str = Query(default="", description="Product status filtri"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, le=200),
    _: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Barcha mahsulotlar ro'yxati (admin uchun)."""
    stmt = (
        select(Product, SourcingSpec.title.label("spec_title"))
        .join(SourcingSpec, Product.sourcing_spec_id == SourcingSpec.id)
        .order_by(Product.created_at.desc())
    )
    if q:
        stmt = stmt.where(
            or_(
                Product.short_code.ilike(f"%{q}%"),
                SourcingSpec.title.ilike(f"%{q}%"),
            )
        )
    if status:
        stmt = stmt.where(Product.status == status)

    stmt = stmt.offset(skip).limit(limit)
    rows = (await session.execute(stmt)).all()
    return [
        {
            "id": str(p.id),
            "short_code": p.short_code,
            "spec_title": spec_title or "Noma'lum",
            "unit_weight_g": p.unit_weight_g,
            "status": p.status,
            "color": p.color,
            "condition": p.condition_on_intake,
            "created_at": p.created_at.isoformat(),
            "label_printed": p.label_printed_at is not None,
        }
        for p, spec_title in rows
    ]


# ─── Stats ───────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(
    _: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Asosiy statistika — frontend AdminStats interfeysi bilan mos."""
    from sqlalchemy import func

    from app.infra.db.models.order import Order

    users_count    = (await session.scalar(select(func.count(User.id))))          or 0
    orders_count   = (await session.scalar(select(func.count(Order.id))))         or 0
    products_count = (await session.scalar(select(func.count(Product.id))))       or 0
    open_disputes  = (await session.scalar(
        select(func.count(Dispute.id)).where(Dispute.resolved_at.is_(None))
    )) or 0
    pending_payouts_rows = (await session.execute(
        select(func.count(Payout.id), func.coalesce(func.sum(Payout.amount), 0))
        .where(Payout.status == PayoutStatus.REQUESTED.value)
    )).one()
    pending_count  = pending_payouts_rows[0] or 0
    pending_amount = pending_payouts_rows[1] or 0

    return {
        "total_users":            users_count,
        "total_orders":           orders_count,
        "total_products":         products_count,
        "open_disputes":          open_disputes,
        "pending_payouts":        pending_count,
        "pending_payouts_amount": f"{pending_amount} USD",
    }
