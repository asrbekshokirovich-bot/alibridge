"""
Dispute repository — da'volar bilan ishlash.
Role: admin (resolve), orderer/carrier (file).
"""
from __future__ import annotations

import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.db.models.dispute import Dispute
from app.domain.enums import DisputeType, DisputeStatus, DisputeResolution


class DisputeRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        *,
        product_id: str,
        pick_id: str,
        filed_by_user_id: str,
        dispute_type: DisputeType,
        description: str,
    ) -> Dispute:
        """Yangi da'vo yaratish."""
        dispute = Dispute(
            id=str(uuid.uuid4()),
            product_id=product_id,
            pick_id=pick_id,
            filed_by_user_id=filed_by_user_id,
            dispute_type=dispute_type,
            description=description,
            status=DisputeStatus.OPEN,
        )
        self._session.add(dispute)
        await self._session.flush()
        return dispute

    async def get_open(self) -> List[Dispute]:
        """Barcha ochiq da'volar (admin uchun)."""
        stmt = (
            select(Dispute)
            .where(Dispute.status.in_([DisputeStatus.OPEN, DisputeStatus.INVESTIGATING]))
            .order_by(Dispute.created_at.asc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_product(self, product_id: str) -> Optional[Dispute]:
        """Mahsulot bo'yicha da'vo."""
        stmt = select(Dispute).where(Dispute.product_id == product_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def resolve(
        self,
        *,
        dispute_id: str,
        resolution: DisputeResolution,
        deduction_amount: Optional[str] = None,
        resolved_by_user_id: str,
        notes: Optional[str] = None,
    ) -> Dispute:
        """Da'voni hal qilish."""
        from datetime import datetime, timezone

        stmt = select(Dispute).where(Dispute.id == dispute_id)
        result = await self._session.execute(stmt)
        dispute = result.scalar_one()

        dispute.status = DisputeStatus.RESOLVED
        dispute.resolution = resolution
        dispute.deduction_amount = deduction_amount
        dispute.resolved_by_user_id = resolved_by_user_id
        dispute.resolution_notes = notes
        dispute.resolved_at = datetime.now(timezone.utc)

        await self._session.flush()
        return dispute

    async def count_open(self) -> int:
        """Ochiq da'volar soni."""
        from sqlalchemy import func
        stmt = select(func.count(Dispute.id)).where(
            Dispute.status.in_([DisputeStatus.OPEN, DisputeStatus.INVESTIGATING])
        )
        result = await self._session.execute(stmt)
        return result.scalar_one()
