"""Carrier endpoint — profil, onboarding va pick operatsiyalari."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user, require_role
from app.api.deps.db import get_db_session
from app.core.config import settings
from app.domain.enums import HandoffStatus, OnboardingChannel, Role
from app.infra.db.models.user import User
from app.repositories.carrier_repo import CarrierPickRepository, CarrierProfileRepository
from app.repositories.user_repo import UserRepository

router = APIRouter()


def _media_key(url: str | None) -> str | None:
    """Saqlangan rasm URL'idan S3 key chiqarish (auth'li ko'rish uchun)."""
    if not url:
        return None
    marker = f"/{settings.s3_bucket}/"
    return url.split(marker, 1)[1] if marker in url else url.lstrip("/")


# ─── Schemas ────────────────────────────────────────────────────────────────────

COMMON_ROUTES = {
    "TAS-IST": {"from": "Toshkent (TAS)", "to": "Istanbul Atatürk (IST)"},
    "TAS-SAW": {"from": "Toshkent (TAS)", "to": "Istanbul Sabiha (SAW)"},
    "SKD-IST": {"from": "Samarqand (SKD)", "to": "Istanbul Atatürk (IST)"},
    "UGC-IST": {"from": "Urganch (UGC)", "to": "Istanbul Atatürk (IST)"},
    "NMA-IST": {"from": "Namangan (NMA)", "to": "Istanbul Atatürk (IST)"},
    "FEG-IST": {"from": "Farg'ona (FEG)", "to": "Istanbul Atatürk (IST)"},
}


class OnboardingRequest(BaseModel):
    # Shaxsiy ma'lumotlar
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    middle_name: str | None = Field(None, max_length=100)
    birth_date: date | None = None

    # Aloqa
    phone: str = Field(..., min_length=7, max_length=20, description="+998901234567")

    # Reys
    depart_iata: str = Field(..., min_length=3, max_length=4)
    arrive_iata: str = Field(..., min_length=3, max_length=4)
    depart_at: datetime
    arrive_at: datetime | None = None
    allowed_kg: float = Field(..., gt=0, le=50, description="Tashiy oladigan maksimal kg")
    flight_number: str | None = Field(None, max_length=10)

    # Fotosuratlar
    passport_photo_url: str | None = None
    ticket_photo_url: str | None = None

    @field_validator("depart_iata", "arrive_iata", mode="before")
    @classmethod
    def upper_iata(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("phone", mode="before")
    @classmethod
    def clean_phone(cls, v: str) -> str:
        digits = "".join(c for c in v if c.isdigit() or c == "+")
        return digits

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()


class CarrierProfileResponse(BaseModel):
    user_id: str
    first_name: str | None
    last_name: str | None
    middle_name: str | None
    birth_date: str | None
    phone: str | None
    depart_iata: str | None
    arrive_iata: str | None
    depart_at: datetime | None
    arrive_at: datetime | None
    allowed_kg: float | None
    flight_number: str | None
    trust_tier: str
    onboarding_complete: bool

    model_config = {"from_attributes": True}

    @staticmethod
    def from_profile(profile, phone: str | None) -> "CarrierProfileResponse":
        return CarrierProfileResponse(
            user_id=str(profile.user_id),
            first_name=profile.first_name,
            last_name=profile.last_name,
            middle_name=profile.middle_name,
            birth_date=profile.birth_date.isoformat() if profile.birth_date else None,
            phone=phone,
            depart_iata=profile.depart_airport_iata,
            arrive_iata=profile.arrive_airport_iata,
            depart_at=profile.depart_at,
            arrive_at=profile.arrive_at,
            allowed_kg=float(profile.allowed_kg) if profile.allowed_kg else None,
            flight_number=profile.flight_number,
            trust_tier=profile.trust_tier or "new",
            onboarding_complete=bool(
                profile.first_name
                and profile.last_name
                and profile.birth_date
                and phone
                and profile.depart_airport_iata
                and profile.arrive_airport_iata
                and profile.depart_at
                and profile.allowed_kg
                and profile.passport_photo_url
                and profile.ticket_photo_url
            ),
        )


# ─── Endpoints ──────────────────────────────────────────────────────────────────


@router.get("/routes")
async def list_routes() -> dict:
    """Mavjud yo'nalishlar ro'yxati (onboarding uchun)."""
    return {"routes": COMMON_ROUTES}


@router.get("/profile")
async def get_profile(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> CarrierProfileResponse | dict:
    """Carrier profilini olish."""
    repo = CarrierProfileRepository(session)
    profile = await repo.get_by_user_id(current_user.id)
    if not profile:
        return {"onboarding_complete": False}
    return CarrierProfileResponse.from_profile(profile, current_user.phone)


@router.post("/profile")
async def carrier_onboarding(
    body: OnboardingRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> CarrierProfileResponse:
    """Carrier onboarding — profil yaratish yoki yangilash.

    Carrier ro'yxatdan o'tishi uchun minimum:
    - Telefon raqam
    - Jo'nash aeroporti (IATA)
    - Kelish aeroporti (IATA)
    - Jo'nash sanasi
    - Maksimal kg
    """
    # 1. Foydalanuvchi telefon raqami va to'liq ismini saqlash
    user_repo = UserRepository(session)
    await user_repo.update_phone(current_user.id, body.phone)
    full_name = " ".join(filter(None, [body.last_name, body.first_name, body.middle_name]))
    current_user.full_name = full_name

    # 2. Carrier profilini upsert
    carrier_repo = CarrierProfileRepository(session)
    profile = await carrier_repo.upsert(
        user_id=current_user.id,
        first_name=body.first_name,
        last_name=body.last_name,
        middle_name=body.middle_name,
        birth_date=body.birth_date,
        depart_airport_iata=body.depart_iata,
        arrive_airport_iata=body.arrive_iata,
        depart_at=body.depart_at,
        arrive_at=body.arrive_at,
        allowed_kg=body.allowed_kg,
        flight_number=body.flight_number,
        passport_photo_url=body.passport_photo_url,
        ticket_photo_url=body.ticket_photo_url,
        liability_consented_at=datetime.now(timezone.utc),
        onboarding_channel=OnboardingChannel.SELF_SERVE.value,
    )
    await session.commit()
    await session.refresh(profile)

    return CarrierProfileResponse.from_profile(profile, body.phone)


@router.get("/picks")
async def get_picks(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Carrier'ning pick tarixi.

    Picks.tsx beklayotgan fieldlar:
      id, product_id, short_code, spec_title,
      locked_cargo_price, locked_currency,
      status, picked_at, delivered_at, payout_status
    """
    from sqlalchemy.orm import selectinload
    from app.infra.db.models.carrier import CarrierPick
    from app.infra.db.models.product import Product
    from app.infra.db.models.payout import PayoutLine

    stmt = (
        select(CarrierPick)
        .options(
            selectinload(CarrierPick.product).selectinload(Product.sourcing_spec),
            selectinload(CarrierPick.payout_lines),
        )
        .where(CarrierPick.carrier_user_id == current_user.id)
        .order_by(CarrierPick.picked_at.desc())
    )
    result = await session.execute(stmt)
    picks = list(result.scalars().all())

    rows = []
    for p in picks:
        product = p.product
        spec_title = (
            product.sourcing_spec.title if product and product.sourcing_spec else "Noma'lum"
        )
        # delivered_at: DROPPED_OFF = TR omborga topshirildi
        # payout_eligible_at ni proxy sifatida ishlatamiz
        is_dropped = p.handoff_status == HandoffStatus.DROPPED_OFF.value
        delivered_at = (
            p.payout_eligible_at.isoformat()
            if is_dropped and p.payout_eligible_at
            else None
        )
        # payout_status — birinchi payout line statusidan
        payout_status = p.payout_lines[0].status if p.payout_lines else None

        rows.append({
            "id": str(p.id),
            "product_id": str(p.product_id),
            "short_code": product.short_code if product else str(p.product_id)[:8],
            "spec_title": spec_title,
            "locked_cargo_price": str(p.locked_cargo_price) if p.locked_cargo_price else "0",
            "locked_currency": p.locked_currency or "USD",
            "status": p.handoff_status,
            "picked_at": p.picked_at.isoformat() if p.picked_at else None,
            "delivered_at": delivered_at,
            "payout_status": payout_status,
            # WH tasdiq holati (carrier "tasdiqlandi/kutilmoqda/rad etildi" ko'radi)
            "wh_approved_at": p.wh_approved_at.isoformat() if p.wh_approved_at else None,
            "wh_rejected_at": p.wh_rejected_at.isoformat() if p.wh_rejected_at else None,
            "rejection_reason": p.rejection_reason,
        })
    return rows


@router.get("/debts")
async def my_debts(
    current_user: User = Depends(require_role(Role.CARRIER)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Yo'lovchining qarzdorligi — yo'qotilgan/zararlangan yuklar uchun."""
    from decimal import Decimal

    from app.domain.enums import DebtStatus
    from app.infra.db.models.debt import CarrierDebt

    rows = list((await session.execute(
        select(CarrierDebt)
        .where(
            CarrierDebt.carrier_user_id == current_user.id,
            CarrierDebt.status == DebtStatus.OUTSTANDING.value,
        )
        .order_by(CarrierDebt.created_at.desc())
    )).scalars().all())

    totals: dict[str, Decimal] = {}
    items = []
    for d in rows:
        totals[d.currency] = totals.get(d.currency, Decimal("0")) + d.amount
        items.append({
            "id": str(d.id),
            "amount": str(d.amount),
            "currency": d.currency,
            "reason": d.reason or "",
            "created_at": d.created_at.isoformat(),
        })
    return {
        "total_by_currency": {k: str(v) for k, v in totals.items()},
        "count": len(items),
        "items": items,
    }


@router.get("/lookup/{user_id}")
async def carrier_lookup(
    user_id: uuid.UUID,
    _: User = Depends(require_role(Role.ADMIN, Role.WAREHOUSE_UZ)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Carrier'ning to'liq ma'lumoti — admin va ombor xodimi uchun.

    Ombor xodimi yukni topshirishdan oldin carrier shaxsini tekshiradi
    (passport/bilet rasmi `/uploads/file` orqali, download token bilan).
    """
    profile = await CarrierProfileRepository(session).get_by_user_id(user_id)
    if not profile:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(message="Carrier profili topilmadi")
    user = await UserRepository(session).get_by_id(user_id)
    full_name = " ".join(
        filter(None, [profile.last_name, profile.first_name, profile.middle_name])
    ) or (user.full_name if user else None)
    return {
        "user_id": str(user_id),
        "full_name": full_name,
        "birth_date": profile.birth_date.isoformat() if profile.birth_date else None,
        "phone": user.phone if user else None,
        "telegram_username": user.telegram_username if user else None,
        "depart_iata": profile.depart_airport_iata,
        "arrive_iata": profile.arrive_airport_iata,
        "depart_at": profile.depart_at.isoformat() if profile.depart_at else None,
        "arrive_at": profile.arrive_at.isoformat() if profile.arrive_at else None,
        "allowed_kg": float(profile.allowed_kg) if profile.allowed_kg else None,
        "flight_number": profile.flight_number,
        "trust_tier": profile.trust_tier,
        "passport_number": profile.passport_number,
        "passport_key": _media_key(profile.passport_photo_url),
        "ticket_key": _media_key(profile.ticket_photo_url),
        "selfie_key": _media_key(profile.selfie_photo_url),
    }
