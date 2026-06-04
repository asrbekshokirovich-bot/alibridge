"""China sourcing repository — Information Firewall (Invariant 2).

China worker faqat "nimani sotib olish kerak" ma'lumotini ko'radi.
orderer_id va customer_paid_amount kabi maxfiy maydonlar response'ga
FIZIK JIHATDAN kirmaydi — SQL select'da ular yo'q.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import FulfillmentStatus, ProductStatus
from app.infra.db.models.order import OrderLine, SourcingSpec
from app.infra.db.models.product import Product


class ChinaSourcingRepository:
    """China worker uchun role-typed DB access."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_open_tickets(self) -> list[dict]:
        """Ochiq sourcing ticketlar (PENDING_SOURCING order_line'lar).

        Information Firewall: maxfiy buyurtmachi/to'lov maydonlari qaytarilmaydi.
        """
        stmt = (
            select(
                OrderLine.id.label("order_line_id"),
                OrderLine.quantity,
                OrderLine.target_unit_weight_g,
                OrderLine.color,
                OrderLine.notes,
                SourcingSpec.id.label("sourcing_spec_id"),
                SourcingSpec.title,
                SourcingSpec.description,
                SourcingSpec.category,
                SourcingSpec.photos,
            )
            .join(SourcingSpec, OrderLine.sourcing_spec_id == SourcingSpec.id)
            .where(
                OrderLine.fulfillment_status == FulfillmentStatus.PENDING_SOURCING.value
            )
            .order_by(OrderLine.created_at.asc())
        )
        rows = (await self.session.execute(stmt)).all()
        return [
            {
                "order_line_id": str(r.order_line_id),
                "sourcing_spec_id": str(r.sourcing_spec_id),
                "title": r.title,
                "description": r.description,
                "category": r.category,
                "photos": list(r.photos) if r.photos else [],
                "quantity": r.quantity,
                "target_unit_weight_g": r.target_unit_weight_g,
                "color": r.color,
                "notes": r.notes,
            }
            for r in rows
        ]

    async def get_my_shipments(self, china_user_id: uuid.UUID) -> list[dict]:
        """China worker yaratgan, hali Tashkentga yetmagan mahsulotlar
        (READY_AT_CHINA yoki IN_TRANSIT_CN_UZ)."""
        stmt = (
            select(
                Product.id,
                Product.short_code,
                Product.status,
                Product.unit_weight_g,
                Product.color,
                SourcingSpec.title,
                SourcingSpec.photos,
            )
            .outerjoin(SourcingSpec, Product.sourcing_spec_id == SourcingSpec.id)
            .where(
                Product.custody_holder_id == china_user_id,
                Product.status.in_(
                    [
                        ProductStatus.READY_AT_CHINA.value,
                        ProductStatus.IN_TRANSIT_CN_UZ.value,
                    ]
                ),
            )
            .order_by(Product.created_at.desc())
        )
        rows = (await self.session.execute(stmt)).all()
        return [
            {
                "id": str(r.id),
                "short_code": r.short_code,
                "status": r.status,
                "unit_weight_g": r.unit_weight_g or 0,
                "color": r.color,
                "title": r.title or "Noma'lum",
                "photo": (list(r.photos)[0] if r.photos else None),
            }
            for r in rows
        ]
