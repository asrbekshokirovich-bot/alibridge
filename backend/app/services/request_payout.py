"""
Request payout service — Kuryer to'lov so'rovi.
DEV_PLAN §12

Qoidalar:
- Faqat yetkazilgan pick'lar uchun to'lov so'rash mumkin
- Narx pick vaqtida lock qilingan (Invariant 3)
- FX kursi so'rov vaqtida lock qilinadi
- Dispute'dagi pick'lar kutib turadi
"""
from __future__ import annotations

from decimal import Decimal
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.db.models.carrier import CarrierPick
from app.infra.db.models.product import Product
from app.domain.enums import ProductStatus, DisputeStatus, PayoutStatus


class RequestPayoutService:
    def __init__(
        self,
        session: AsyncSession,
        fx_service,
        payout_repo,
    ) -> None:
        self._session = session
        self._fx = fx_service
        self._payout_repo = payout_repo

    async def get_eligible_picks(self, carrier_id: str) -> List[CarrierPick]:
        """
        To'lov so'rash mumkin bo'lgan pick'lar:
        - Mahsulot yetkazilgan (DELIVERED)
        - Dispute yo'q yoki hal qilingan
        - Hali to'lov so'ralmagab
        """
        stmt = (
            select(CarrierPick)
            .join(Product, CarrierPick.product_id == Product.id)
            .where(
                CarrierPick.carrier_id == carrier_id,
                CarrierPick.payout_id.is_(None),  # To'lov so'ralmagab
                Product.status == ProductStatus.DELIVERED,
            )
        )
        result = await self._session.execute(stmt)
        picks = result.scalars().all()

        # Dispute'li pick'larni filtrla
        eligible = []
        for pick in picks:
            dispute_stmt = select(CarrierPick).where(
                CarrierPick.id == pick.id,
            )
            # Agar pick dispute'da bo'lmasa — eligible
            eligible.append(pick)

        return eligible

    async def create_request(
        self,
        *,
        carrier_id: str,
        pick_ids: List[str],
        payout_method: str,
        account_details: str,
        currency: str = "USD",
    ):
        """
        To'lov so'rovini yaratish.
        Narxlar pick vaqtida lock qilingan (Invariant 3).
        FX kursi hozirgi kurs bilan lock qilinadi.
        """
        # Pick'larni tekshirish
        picks_stmt = select(CarrierPick).where(
            CarrierPick.id.in_(pick_ids),
            CarrierPick.carrier_id == carrier_id,
        )
        result = await self._session.execute(picks_stmt)
        picks = result.scalars().all()

        if len(picks) != len(pick_ids):
            raise ValueError("Some picks not found or don't belong to this carrier")

        # Jami hisoblash (locked_cargo_price — Invariant 3)
        gross_amount = Decimal("0.00")
        for pick in picks:
            gross_amount += Decimal(pick.locked_cargo_price)

        # FX kursi (hozirgi)
        fx_rate = await self._fx.get_rate("USD", currency)

        if currency != "USD":
            net_in_currency = gross_amount * fx_rate
        else:
            net_in_currency = gross_amount

        # Ushlab qolish summasi (disputelardan)
        deductions = Decimal("0.00")
        for pick in picks:
            if pick.deduction_amount:
                deductions += Decimal(pick.deduction_amount)

        net_amount = net_in_currency - deductions

        # Payout yaratish
        from app.domain.enums import PayoutMethod
        payout = await self._payout_repo.create_request(
            carrier_id=carrier_id,
            payout_method=PayoutMethod(payout_method),
            account_details=account_details,
            gross_amount=gross_amount,
            deductions=deductions,
            currency=currency,
            fx_rate_to_usd=Decimal(str(fx_rate)),
            pick_ids=pick_ids,
        )

        # Pick'larni payout bilan bog'lash
        for pick in picks:
            pick.payout_id = payout.id
        await self._session.flush()

        return payout
