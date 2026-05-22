"""
Resolve dispute service — da'voni hal qilish.
DEV_PLAN §13

Hal qilish turlari:
- CARRIER_FAULT: to'lovdan ushlab qolinadi
- FORCE_MAJEURE: hech kim aybdor emas
- ORDERER_FAULT: buyurtmachi tomonidan
- SPLIT: ikki taraflama

Natijalar:
- CarrierPick.deduction_amount yangilanadi
- Payout hisob-kitobi qayta hisoblanadi (agar so'ralgan bo'lsa)
- Barcha tomonlar xabardor qilinadi
"""
from __future__ import annotations

from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.db.models.dispute import Dispute
from app.infra.db.models.carrier import CarrierPick
from app.domain.enums import DisputeStatus, DisputeResolution


class ResolveDisputeService:
    def __init__(
        self,
        session: AsyncSession,
        dispute_repo,
        notifier=None,
    ) -> None:
        self._session = session
        self._dispute_repo = dispute_repo
        self._notifier = notifier

    async def resolve(
        self,
        *,
        dispute_id: str,
        resolution: DisputeResolution,
        deduction_amount: Optional[str] = None,
        resolved_by_user_id: str,
        notes: Optional[str] = None,
    ) -> Dispute:
        """
        Da'voni hal qilish:
        1. Dispute statusini RESOLVED ga o'zgartirish
        2. Agar CARRIER_FAULT yoki SPLIT → CarrierPick.deduction_amount o'rnatish
        3. Barcha tomonlarni xabardor qilish
        """
        # Dispute olish
        stmt = select(Dispute).where(Dispute.id == dispute_id)
        result = await self._session.execute(stmt)
        dispute = result.scalar_one()

        if dispute.status == DisputeStatus.RESOLVED:
            raise ValueError(f"Dispute {dispute_id} is already resolved")

        # Ushlab qolish summasi
        if resolution in (DisputeResolution.CARRIER_FAULT, DisputeResolution.SPLIT):
            if not deduction_amount:
                raise ValueError("Deduction amount required for CARRIER_FAULT or SPLIT")

            # CarrierPick'ga ushlab qolish summasi o'rnatish
            pick_stmt = select(CarrierPick).where(
                CarrierPick.product_id == dispute.product_id
            )
            pick_result = await self._session.execute(pick_stmt)
            pick = pick_result.scalar_one_or_none()
            if pick:
                pick.deduction_amount = deduction_amount

        # Dispute hal qilish
        dispute = await self._dispute_repo.resolve(
            dispute_id=dispute_id,
            resolution=resolution,
            deduction_amount=deduction_amount,
            resolved_by_user_id=resolved_by_user_id,
            notes=notes,
        )

        # Bildirishnomalar
        if self._notifier:
            await self._notifier.notify_dispute_resolved(
                dispute=dispute,
                resolution=resolution,
            )

        return dispute

    async def escalate(self, dispute_id: str, escalated_by_user_id: str) -> Dispute:
        """Da'voni INVESTIGATING holatiga o'tkazish."""
        stmt = select(Dispute).where(Dispute.id == dispute_id)
        result = await self._session.execute(stmt)
        dispute = result.scalar_one()
        dispute.status = DisputeStatus.INVESTIGATING
        await self._session.flush()
        return dispute
