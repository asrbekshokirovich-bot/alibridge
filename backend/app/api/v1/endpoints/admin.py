"""Admin endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator
from sqlalchemy import delete as sa_delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_role
from app.api.deps.db import get_db_session
from app.domain.enums import DebtStatus, PayoutStatus, Role
from app.infra.db.models.carrier import CarrierProfile, CarrierPick
from app.infra.db.models.custody import CustodyEvent
from app.infra.db.models.debt import CarrierDebt
from app.infra.db.models.dispute import Dispute
from app.infra.db.models.order import SourcingSpec
from app.infra.db.models.payout import Payout, PayoutLine
from app.infra.db.models.product import Product
from app.infra.db.models.user import User
from app.repositories.user_repo import UserRepository
from sqlalchemy import func

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

    # L3: bot auth cache'ni tozalash (yangi rol darhol kuchga kirsin)
    from app.infra.cache.redis_client import invalidate_bot_auth_cache
    await invalidate_bot_auth_cache(target.telegram_id)

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
    target = await repo.get_by_id(user_id)
    revoked = await repo.revoke_role(user_id=user_id, role=role)
    if not revoked:
        raise HTTPException(status_code=404, detail="Rol topilmadi yoki allaqachon bekor qilingan")
    await session.commit()

    # L3: bot auth cache'ni tozalash (rol darhol olinsin)
    if target:
        from app.infra.cache.redis_client import invalidate_bot_auth_cache
        await invalidate_bot_auth_cache(target.telegram_id)

    return {"revoked": True, "user_id": str(user_id), "role": role}


# ─── Disputes ───────────────────────────────────────────────────────────────────

@router.get("/disputes")
async def list_disputes(
    # MED-6 fix: faqat aniq qiymatlar — "har qanday string = barchasi" xatosi yo'q
    status: Literal["OPEN", "RESOLVED"] = Query(default="OPEN"),
    _: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Disputlar ro'yxati."""
    stmt = (
        select(Dispute, Product.short_code, User.full_name.label("filed_by_name"))
        .join(Product, Dispute.product_id == Product.id)
        .join(User, Dispute.raised_by_user_id == User.id)
    )
    if status == "OPEN":
        stmt = stmt.where(Dispute.resolved_at.is_(None))
    else:  # "RESOLVED"
        stmt = stmt.where(Dispute.resolved_at.isnot(None))
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
    # HIGH-4 fix: faqat ruxsat etilgan qiymatlar (enum validation)
    resolution: Literal["CARRIER_FAULT", "FORCE_MAJEURE", "ORDERER_FAULT", "SPLIT"]
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

    # Avtomatik qarzdorlik — yo'lovchi aybdor bo'lsa (CARRIER_FAULT/SPLIT)
    debt_amount: str | None = None
    if body.resolution in ("CARRIER_FAULT", "SPLIT"):
        product = await session.get(Product, dispute.product_id)
        pick = (await session.execute(
            select(CarrierPick)
            .where(CarrierPick.product_id == dispute.product_id)
            .order_by(CarrierPick.picked_at.desc())
        )).scalars().first()
        if product and pick:
            # Summa: admin kiritgan bo'lsa o'sha, aks holda mahsulot qiymati
            if body.deduction_amount:
                amount = Decimal(body.deduction_amount)
            else:
                amount = product.declared_value or Decimal("0")
            if amount > 0:
                session.add(CarrierDebt(
                    carrier_user_id=pick.carrier_user_id,
                    product_id=product.id,
                    dispute_id=dispute.id,
                    amount=amount,
                    currency=product.declared_currency or "USD",
                    reason=f"{body.resolution} — {product.short_code}"
                           + (f": {body.notes}" if body.notes else ""),
                    status=DebtStatus.OUTSTANDING.value,
                ))
                debt_amount = str(amount)

    await session.commit()
    return {"status": "resolved", "resolution": body.resolution, "debt_created": debt_amount}


# ─── Carrier debts (qarzdorlik) ──────────────────────────────────────────────────

@router.get("/debts")
async def list_debts(
    status: Literal["outstanding", "settled", "all"] = Query(default="outstanding"),
    _: User = Depends(require_role(Role.ADMIN, Role.WAREHOUSE_UZ, Role.WAREHOUSE_TR)),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Yo'lovchilar qarzdorligi — admin va ombor xodimlari ko'radi."""
    stmt = (
        select(CarrierDebt, User.full_name, Product.short_code)
        .join(User, CarrierDebt.carrier_user_id == User.id)
        .outerjoin(Product, CarrierDebt.product_id == Product.id)
        .order_by(CarrierDebt.created_at.desc())
    )
    if status != "all":
        stmt = stmt.where(CarrierDebt.status == status)
    rows = (await session.execute(stmt)).all()
    return [
        {
            "id": str(d.id),
            "carrier_user_id": str(d.carrier_user_id),
            "carrier_name": full_name or "Noma'lum",
            "product_short_code": short_code or "—",
            "amount": str(d.amount),
            "currency": d.currency,
            "reason": d.reason or "",
            "status": d.status,
            "created_at": d.created_at.isoformat(),
            "settled_at": d.settled_at.isoformat() if d.settled_at else None,
        }
        for d, full_name, short_code in rows
    ]


@router.post("/debts/{debt_id}/settle")
async def settle_debt(
    debt_id: uuid.UUID,
    admin: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Qarzdorlikni yopilgan deb belgilash (faqat admin)."""
    debt = await session.get(CarrierDebt, debt_id)
    if not debt:
        raise HTTPException(status_code=404, detail="Qarzdorlik topilmadi")
    debt.status = DebtStatus.SETTLED.value
    debt.settled_at = datetime.now(timezone.utc)
    debt.settled_by_admin_id = admin.id
    await session.commit()
    return {"status": "settled"}


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
    _: User = Depends(require_role(Role.ADMIN, Role.WAREHOUSE_TR)),
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


@router.get("/products/specs")
async def list_product_specs(
    q: str = Query(default="", max_length=100),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, le=500),
    _: User = Depends(require_role(Role.ADMIN, Role.WAREHOUSE_TR)),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Mahsulotlar spec (katalog) bo'yicha guruhlangan.

    count       — toshkent omborida mavjud (AT_TASHKENT_WH + IN_BASKET)
    total_count — tizimda jami (barcha statuslar, cancelled/lost bundan tashqari)
    """
    from app.domain.enums import ProductStatus

    warehouse_statuses = [
        ProductStatus.AT_TASHKENT_WH.value,
        ProductStatus.IN_BASKET.value,
    ]
    active_statuses = [
        ProductStatus.PENDING_INTAKE.value,
        ProductStatus.AT_TASHKENT_WH.value,
        ProductStatus.IN_BASKET.value,
        ProductStatus.WITH_COURIER_UZ.value,
        ProductStatus.WITH_CARRIER.value,
        ProductStatus.IN_FLIGHT.value,
        ProductStatus.WITH_COURIER_TR.value,
        ProductStatus.AT_TR_WH.value,
        ProductStatus.DELIVERED.value,
    ]

    stmt = (
        select(
            SourcingSpec.id,
            SourcingSpec.title,
            SourcingSpec.photos,
            func.count(Product.id).filter(
                Product.status.in_(warehouse_statuses)
            ).label("count"),
            func.count(Product.id).filter(
                Product.status.in_(active_statuses)
            ).label("total_count"),
            func.coalesce(
                func.sum(Product.unit_weight_g).filter(Product.status.in_(warehouse_statuses)), 0
            ).label("total_weight_g"),
            func.coalesce(
                func.sum(Product.tare_weight_g).filter(Product.status.in_(warehouse_statuses)), 0
            ).label("total_tare_weight_g"),
            func.max(Product.created_at).label("last_created"),
        )
        .join(Product, Product.sourcing_spec_id == SourcingSpec.id)
        .where(Product.status.in_(active_statuses))
        .group_by(SourcingSpec.id, SourcingSpec.title)
        .order_by(func.max(Product.created_at).desc())
    )
    if q:
        stmt = stmt.where(SourcingSpec.title.ilike(f"%{q}%"))
    stmt = stmt.offset(skip).limit(limit)
    rows = (await session.execute(stmt)).all()
    return [
        {
            "spec_id": str(r.id),
            "title": r.title,
            "photo": (list(r.photos)[0] if r.photos else None),
            "count": r.count,
            "total_count": r.total_count,
            "total_weight_g": int(r.total_weight_g or 0),
            "total_tare_weight_g": int(r.total_tare_weight_g or 0),
            "last_created": r.last_created.isoformat(),
        }
        for r in rows
    ]


@router.get("/products/specs/{spec_id}/items")
async def list_spec_products(
    spec_id: uuid.UUID,
    _: User = Depends(require_role(Role.ADMIN, Role.WAREHOUSE_TR)),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Bitta spec ichidagi barcha mahsulotlar."""
    stmt = (
        select(Product)
        .where(Product.sourcing_spec_id == spec_id)
        .order_by(Product.created_at.asc())
    )
    products = (await session.execute(stmt)).scalars().all()
    return [
        {
            "id": str(p.id),
            "short_code": p.short_code,
            "status": p.status,
            "unit_weight_g": p.unit_weight_g,
            "tare_weight_g": p.tare_weight_g,
            "label_printed": p.label_printed_at is not None,
            "created_at": p.created_at.isoformat(),
            "qr_payload": p.qr_payload,
        }
        for p in products
    ]


@router.get("/products/{product_id}/qr")
async def get_product_qr(
    product_id: uuid.UUID,
    _: User = Depends(require_role(Role.ADMIN, Role.WAREHOUSE_TR)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Mahsulot shtrix-kodi (Code128 PNG, base64)."""
    import base64
    from io import BytesIO
    import barcode
    from barcode.writer import ImageWriter

    product = await session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")

    # Code128 — alphanumeric short_code uchun ideal
    buf = BytesIO()
    code128 = barcode.get(
        "code128",
        product.short_code,
        writer=ImageWriter(),
    )
    code128.write(
        buf,
        options={
            "module_width": 0.35,
            "module_height": 20.0,
            "font_size": 12,
            "text_distance": 4.0,
            "quiet_zone": 4.0,
            "dpi": 200,
            "write_text": True,
        },
    )
    return {
        "id": str(product.id),
        "short_code": product.short_code,
        "status": product.status,
        "qr_image_b64": base64.b64encode(buf.getvalue()).decode("ascii"),
        "qr_payload": product.qr_payload,
    }


@router.get("/products/specs/{spec_id}/labels-pdf")
async def spec_labels_pdf(
    spec_id: uuid.UUID,
    _: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db_session),
) -> StreamingResponse:
    """Bitta spec (katalog) dagi barcha mahsulotlar uchun PDF label."""
    from io import BytesIO
    from app.infra.labels.pdf import generate_labels_pdf, LabelData

    stmt = (
        select(Product, SourcingSpec.title, SourcingSpec.default_weight_g)
        .join(SourcingSpec, Product.sourcing_spec_id == SourcingSpec.id)
        .where(Product.sourcing_spec_id == spec_id)
        .order_by(Product.created_at.asc())
    )
    rows = (await session.execute(stmt)).all()
    if not rows:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")

    labels = [
        LabelData(
            short_code=p.short_code,
            qr_payload=p.qr_payload,
            barcode_payload=p.short_code,
            product_title=title or "Noma'lum",
            weight_g=p.unit_weight_g or wg or 0,
        )
        for p, title, wg in rows
    ]

    pdf_bytes = generate_labels_pdf(labels)
    filename = f"labels-{str(spec_id)[:8]}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/products/labels-pdf")
async def selected_labels_pdf(
    ids: str = Query(..., description="vergul bilan ajratilgan product UUID lar"),
    _: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db_session),
) -> StreamingResponse:
    """Tanlangan mahsulotlar uchun PDF label — ?ids=uuid1,uuid2,..."""
    from io import BytesIO
    from app.infra.labels.pdf import generate_labels_pdf, LabelData

    raw_ids = [i.strip() for i in ids.split(",") if i.strip()]
    if len(raw_ids) > 200:   # MED-9 fix
        raise HTTPException(status_code=400, detail="Bir vaqtda maksimal 200 ta")
    try:
        product_ids = [uuid.UUID(i) for i in raw_ids]
    except ValueError:
        raise HTTPException(status_code=400, detail="UUID format noto'g'ri")

    stmt = (
        select(Product, SourcingSpec.title, SourcingSpec.default_weight_g)
        .join(SourcingSpec, Product.sourcing_spec_id == SourcingSpec.id)
        .where(Product.id.in_(product_ids))
        .order_by(Product.created_at.asc())
    )
    rows = (await session.execute(stmt)).all()
    if not rows:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")

    labels = [
        LabelData(
            short_code=p.short_code,
            qr_payload=p.qr_payload,
            barcode_payload=p.short_code,
            product_title=title or "Noma'lum",
            weight_g=p.unit_weight_g or wg or 0,
        )
        for p, title, wg in rows
    ]

    pdf_bytes = generate_labels_pdf(labels)
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="labels.pdf"'},
    )


@router.delete("/products/bulk", status_code=200)
async def bulk_delete_products(
    ids: str = Query(..., description="vergul bilan ajratilgan product UUID lar"),
    _: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Bir transaksiyada ko'plab mahsulotlarni o'chirish — tez va atomic."""
    raw_ids = [i.strip() for i in ids.split(",") if i.strip()]
    if not raw_ids:
        return {"deleted": 0, "product_ids": []}
    if len(raw_ids) > 200:   # MED-9 fix
        raise HTTPException(status_code=400, detail="Bir vaqtda maksimal 200 ta o'chirish mumkin")
    try:
        product_ids = [uuid.UUID(i) for i in raw_ids]
    except ValueError:
        raise HTTPException(status_code=400, detail="UUID format noto'g'ri")

    try:
        # 1. PayoutLine → CarrierPick
        pick_ids = (await session.execute(
            select(CarrierPick.id).where(CarrierPick.product_id.in_(product_ids))
        )).scalars().all()
        if pick_ids:
            await session.execute(
                sa_delete(PayoutLine).where(PayoutLine.carrier_pick_id.in_(pick_ids))
            )

        # 2. CarrierPick
        await session.execute(
            sa_delete(CarrierPick).where(CarrierPick.product_id.in_(product_ids))
        )

        # 3. CustodyEvent
        await session.execute(
            sa_delete(CustodyEvent).where(CustodyEvent.product_id.in_(product_ids))
        )

        # 4. Dispute
        await session.execute(
            sa_delete(Dispute).where(Dispute.product_id.in_(product_ids))
        )

        # 5. Mahsulotlar — hammasi bitta DELETE bilan
        result = await session.execute(
            sa_delete(Product).where(Product.id.in_(product_ids))
        )
        await session.commit()

        return {"deleted": result.rowcount, "product_ids": [str(i) for i in product_ids]}

    except Exception:
        await session.rollback()
        raise HTTPException(status_code=500, detail="O'chirishda xato yuz berdi")


@router.delete("/products/{product_id}", status_code=200)
async def delete_product(
    product_id: uuid.UUID,
    _: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Mahsulotni o'chirish — bog'liq yozuvlar (custody, pick, dispute) ham o'chiriladi."""
    product = await session.get(Product, product_id)
    if not product:
        # Allaqachon o'chirilgan — muvaffaqiyat deb hisoblaymiz (idempotent)
        return {"deleted": True, "product_id": str(product_id)}

    try:
        # 1. PayoutLine → CarrierPick
        pick_ids = (await session.execute(
            select(CarrierPick.id).where(CarrierPick.product_id == product_id)
        )).scalars().all()
        if pick_ids:
            await session.execute(
                sa_delete(PayoutLine).where(PayoutLine.carrier_pick_id.in_(pick_ids))
            )

        # 2. CarrierPick
        await session.execute(
            sa_delete(CarrierPick).where(CarrierPick.product_id == product_id)
        )

        # 3. CustodyEvent
        await session.execute(
            sa_delete(CustodyEvent).where(CustodyEvent.product_id == product_id)
        )

        # 4. Dispute
        await session.execute(
            sa_delete(Dispute).where(Dispute.product_id == product_id)
        )

        # 5. Mahsulot
        await session.delete(product)
        await session.commit()
    except Exception:
        await session.rollback()
        raise HTTPException(status_code=500, detail="O'chirishda xato yuz berdi")

    return {"deleted": True, "product_id": str(product_id)}


# ─── Carriers ────────────────────────────────────────────────────────────────────

@router.get("/carriers/all")
async def all_carriers(
    q: str = Query(default="", max_length=100, description="Ism/telefon bo'yicha qidiruv"),
    _: User = Depends(require_role(Role.ADMIN, Role.WAREHOUSE_TR)),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Barcha ro'yxatdan o'tgan yo'lovchilar (carrier'lar) ro'yxati.

    Har biri bosilganda /carrier/lookup/{user_id} orqali to'liq ma'lumot ochiladi.
    """
    stmt = (
        select(
            CarrierProfile,
            User.full_name,
            User.telegram_username,
            User.phone,
        )
        .join(User, CarrierProfile.user_id == User.id)
        .order_by(CarrierProfile.created_at.desc())
    )
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                User.full_name.ilike(like),
                User.phone.ilike(like),
                CarrierProfile.first_name.ilike(like),
                CarrierProfile.last_name.ilike(like),
            )
        )
    rows = (await session.execute(stmt)).all()
    return [
        {
            "user_id": str(p.user_id),
            "full_name": (
                f"{p.last_name or ''} {p.first_name or ''}".strip() or full_name or "Noma'lum"
            ),
            "phone": phone,
            "telegram_username": username,
            "depart_iata": p.depart_airport_iata,
            "arrive_iata": p.arrive_airport_iata,
            "depart_at": p.depart_at.isoformat() if p.depart_at else None,
            "allowed_kg": float(p.allowed_kg) if p.allowed_kg else None,
            "has_passport": bool(p.passport_photo_url),
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p, full_name, username, phone in rows
    ]


# ─── Stats ───────────────────────────────────────────────────────────────────────

@router.get("/carriers/active")
async def active_carriers(
    _: User = Depends(require_role(Role.ADMIN, Role.WAREHOUSE_TR)),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Hozirda mahsulot olib ketayotgan (yoki olib ketgan) yo'lovchilar.

    AWAITING_HANDOFF   — savat tasdiqlagan, hali skanerlashmagan
    CARRIER_HAS_CUSTODY — ombordan olib ketdi, yo'lda
    IN_FLIGHT          — parvozda
    """
    from app.domain.enums import HandoffStatus
    from sqlalchemy.orm import selectinload

    active_statuses = [
        HandoffStatus.IN_BASKET.value,
        HandoffStatus.AWAITING_HANDOFF.value,
        HandoffStatus.CARRIER_HAS_CUSTODY.value,
        HandoffStatus.IN_FLIGHT.value,
        HandoffStatus.DROPPED_OFF.value,
    ]

    stmt = (
        select(CarrierPick)
        .options(
            selectinload(CarrierPick.product).selectinload(Product.sourcing_spec),
        )
        .where(CarrierPick.handoff_status.in_(active_statuses))
        .order_by(CarrierPick.picked_at.desc())
    )
    picks = list((await session.execute(stmt)).scalars().all())

    carrier_ids = list({p.carrier_user_id for p in picks})
    users_map: dict = {}
    if carrier_ids:
        for u in (await session.execute(select(User).where(User.id.in_(carrier_ids)))).scalars():
            users_map[u.id] = u

    groups: dict = {}
    for pick in picks:
        cid = str(pick.carrier_user_id)
        if cid not in groups:
            u = users_map.get(pick.carrier_user_id)
            groups[cid] = {
                "carrier_id": cid,
                "carrier_name": (u.full_name or u.telegram_username or cid[:8]) if u else cid[:8],
                "telegram_username": u.telegram_username if u else None,
                "items": [],
                "total_weight_g": 0,
            }
        product = pick.product
        spec = product.sourcing_spec if product else None
        groups[cid]["items"].append({
            "short_code": product.short_code if product else "",
            "spec_title": spec.title if spec else "Noma'lum",
            "unit_weight_g": product.unit_weight_g if product else 0,
            "status": pick.handoff_status,
        })
        groups[cid]["total_weight_g"] += product.unit_weight_g if product else 0

    return list(groups.values())


@router.get("/stats")
async def get_stats(
    _: User = Depends(require_role(Role.ADMIN, Role.WAREHOUSE_TR)),
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
