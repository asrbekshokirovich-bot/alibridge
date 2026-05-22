"""
Payout repository — to'lovlar bilan ishlash.
Role: carrier (request), admin (approve/reject).
"""
from __future__ import annotations

import uuid
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infra.db.models.payout import Payout, PayoutLine
from app.domain.enums import PayoutStatus, PayoutMethod


class PayoutRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_request(
        self,
        *,
        carrier_id: str,
        payout_method: PayoutMethod,
        account_details: str,
        gross_amount: Decimal,
        deductions: Decimal,
        currency: str,
        fx_rate_to_usd: Decimal,
        pick_ids: List[str],
    ) -> Payout:
        """Kuryer to'lov so'rovi yaratish."""
        net_amount = gross_amount - deductions
        payout = Payout(
            id=str(uuid.uuid4()),
            carrier_id=carrier_id,
            payout_method=payout_method,
            account_details=account_details,
            gross_amount=str(gross_amount),
            deductions=str(deductions),
            net_amount=str(net_amount),
            currency=currency,
            fx_rate_to_usd=str(fx_rate_to_usd),
            status=PayoutStatus.REQUESTED,
        )
        self._session.add(payout)
        await self._session.flush()

        # PayoutLine'lar qo'shish
        for pick_id in pick_ids:
            line = PayoutLine(
                id=str(uuid.uuid4()),
                payout_id=payout.id,
                pick_id=pick_id,
            )
            self._session.add(line)

        await self._session.flush()
        return payout

    async def get_by_carrier(
        self, carrier_id: str, status: Optional[PayoutStatus] = None
    ) -> List[Payout]:
        """Carrier to'lovlari ro'yxati."""
        stmt = select(Payout).where(Payout.carrier_id == carrier_id)
        if status:
            stmt = stmt.where(Payout.status == status)
        stmt = stmt.order_by(Payout.created_at.desc())
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_pending(self) -> List[Payout]:
        """Admin uchun kutayotgan to'lovlar."""
        stmt = (
            select(Payout)
            .where(Payout.status == PayoutStatus.REQUESTED)
            .order_by(Payout.created_at.asc())
            .options(selectinload(Payout.lines))
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def approve(self, payout_id: str) -> None:
        """To'lovni tasdiqlash."""
        from datetime import datetime, timezone
        stmt = select(Payout).where(Payout.id == payout_id)
        result = await self._session.execute(stmt)
        payout = result.scalar_one_or_none()
        if payout:
            payout.status = PayoutStatus.PAID
            payout.paid_at = datetime.now(timezone.utc)
            await self._session.flush()

    async def reject(self, payout_id: str, reason: str) -> None:
        """To'lovni rad etish."""
        stmt = select(Payout).where(Payout.id == payout_id)
        result = await self._session.execute(stmt)
        payout = result.scalar_one_or_none()
        if payout:
            payout.status = PayoutStatus.REJECTED
            payout.rejection_reason = reason
            await self._session.flush()
