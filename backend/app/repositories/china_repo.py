"""China worker repository — INVARIANT 2 (Information Firewall) ⚠️

China xodimi ko'rishi MUMKIN BO'LMAGAN maydonlar:
- orderer_id / orderer_user_id
- customer_paid_amount / customer_paid_currency
- product.id, product.qr_payload (chunki mahsulot QR'i hali yaratilmagan)
- carrier ma'lumotlari
- payout ma'lumotlari

Bu fayldagi query'lar shu maydonlarni ASLO qaytarmaydi (kodda ham yo'q).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import select

from app.domain.enums import FulfillmentStatus
from app.infra.db.models.order import OrderLine, SourcingSpec
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True, slots=True)
class SourcingTicket:
    """China worker uchun cheklangan ko'rinish.

    Diqqat: bu sinfda orderer_id yoki customer_paid yo'q.
    Bu — atayin. Kodda mavjud bo'lmasa, leak qilib bo'lmaydi.
    """

    order_line_id: uuid.UUID
    spec_title: str
    spec_description: str | None
    spec_category: str | None
    spec_photos: list  # JSONB
    target_unit_weight_g: int | None
    quantity: int
    color: str | None
    notes: str | None
    is_urgent: bool


class ChinaRepository:
    """China worker uchun maxsus repo.

    Bu sinf User repo'dan meros olmaydi — atayin alohida.
    JOIN'lar yo'q user yoki order'larga.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_open_tickets(self, *, limit: int = 50, offset: int = 0) -> list[SourcingTicket]:
        """Ochiq sourcing ticket'lar.

        FAQAT quyidagi maydonlarni qaytaradi:
        - order_line_id (opaque)
        - spec ma'lumotlari
        - quantity, color, notes
        - urgent flag

        order_id, orderer_user_id, customer_paid_* — yo'q.
        """
        query = (
            select(
                OrderLine.id,
                SourcingSpec.title,
                SourcingSpec.description,
                SourcingSpec.category,
                SourcingSpec.photos,
                OrderLine.target_unit_weight_g,
                OrderLine.quantity,
                OrderLine.color,
                OrderLine.notes,
                SourcingSpec.is_urgent,
            )
            .join(SourcingSpec, SourcingSpec.id == OrderLine.sourcing_spec_id)
            .where(
                OrderLine.fulfillment_status.in_(
                    [
                        FulfillmentStatus.PENDING_SOURCING.value,
                        FulfillmentStatus.SOURCING.value,
                    ]
                )
            )
            .order_by(SourcingSpec.is_urgent.desc(), OrderLine.created_at.asc())
            .limit(limit)
            .offset(offset)
        )

        result = await self.session.execute(query)
        rows = result.all()

        return [
            SourcingTicket(
                order_line_id=row[0],
                spec_title=row[1],
                spec_description=row[2],
                spec_category=row[3],
                spec_photos=row[4] or [],
                target_unit_weight_g=row[5],
                quantity=row[6],
                color=row[7],
                notes=row[8],
                is_urgent=row[9],
            )
            for row in rows
        ]

    async def mark_sourcing(self, order_line_id: uuid.UUID) -> None:
        """Ticket'ni 'sourcing' deb belgilash."""
        result = await self.session.execute(
            select(OrderLine).where(OrderLine.id == order_line_id)
        )
        line = result.scalar_one_or_none()
        if line:
            line.fulfillment_status = FulfillmentStatus.SOURCING.value
            await self.session.flush()
