"""Payouts endpoint — carrier'lar uchun to'lov."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps.auth import get_current_user, require_role
from app.api.deps.db import get_db_session
from app.domain.entities.payout import PayoutEntity
from app.domain.enums import DisputeStatus, HandoffStatus, PayoutMethod, PayoutStatus, Role
from app.infra.db.models.carrier import CarrierPick
from app.infra.db.models.payout import Payout, PayoutLine
from app.infra.db.models.user import User

router = APIRouter()


class RequestPayoutRequest(BaseModel):
    method: PayoutMethod
    payment_reference: str | None = None
    currency: str = "USD"


@router.get("", response_model=list[PayoutEntity])
async def list_my_payouts(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[PayoutEntity]:
    """Mening payout tarixim."""
    result = await session.execute(
        select(Payout)
        .options(selectinload(Payout.lines))
        .where(Payout.carrier_user_id == user.id)
        .order_by(Payout.requested_at.desc())
    )
    payouts = list(result.scalars().all())
    return [PayoutEntity.model_validate(p) for p in payouts]


@router.post("", status_code=201)
async def request_payout(
    body: RequestPayoutRequest,
    user: User = Depends(require_role(Role.CARRIER)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Payout so'rash — to'lanmagan deliveredpicklar uchun."""
    # Carrier ning DELIVERED + dispute yo'q picklar
    picks_stmt = select(CarrierPick).where(
        CarrierPick.carrier_user_id == user.id,
        CarrierPick.handoff_status == HandoffStatus.DELIVERED.value,
        CarrierPick.dispute_status == DisputeStatus.NONE.value,
    )
    all_picks = (await session.execute(picks_stmt)).scalars().all()

    # Allaqachon payout ga kirgan picklarni chiqarib tashlash
    already_in_payout_stmt = select(PayoutLine.carrier_pick_id)
    already_ids = {r[0] for r in (await session.execute(already_in_payout_stmt)).all()}
    eligible = [p for p in all_picks if p.id not in already_ids]

    if not eligible:
        raise HTTPException(status_code=400, detail="To'lanadigan yuk yo'q")

    total = sum(p.locked_cargo_price for p in eligible)

    if total <= 0:
        raise HTTPException(status_code=400, detail="Payout summasi noldan katta bo'lishi kerak")

    payout = Payout(
        id=uuid.uuid4(),
        carrier_user_id=user.id,
        amount=total,
        currency=body.currency,
        method=body.method.value,
        payment_reference=body.payment_reference,
        status=PayoutStatus.REQUESTED.value,
        requested_at=datetime.now(timezone.utc),
    )
    session.add(payout)
    await session.flush()

    for pick in eligible:
        session.add(PayoutLine(
            id=uuid.uuid4(),
            payout_id=payout.id,
            carrier_pick_id=pick.id,
            amount=pick.locked_cargo_price,
            deduction=Decimal("0"),
        ))

    await session.commit()
    return {
        "payout_id": str(payout.id),
        "amount": str(total),
        "currency": body.currency,
        "pick_count": len(eligible),
        "status": PayoutStatus.REQUESTED.value,
    }
