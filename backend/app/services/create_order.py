"""Buyurtma yaratish service.

2 ta yo'l:
1. Self-service (bot orqali) — orderer_user_id beriladi
2. Walk-in (warehouse worker tomonidan) — walk_in_customer_id beriladi
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationError
from app.domain.enums import FulfillmentStatus, OrderSource, OrderStatus
from app.infra.db.models.order import Order, OrderLine


@dataclass(slots=True)
class OrderLineInput:
    """Buyurtma qatori uchun input."""

    sourcing_spec_id: uuid.UUID
    quantity: int
    target_unit_weight_g: int | None = None
    color: str | None = None
    notes: str | None = None
    customer_paid_amount: Decimal | None = None
    customer_paid_currency: str | None = None


class CreateOrderService:
    """Buyurtma yaratish use case."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        *,
        created_by_user_id: uuid.UUID,
        lines: list[OrderLineInput],
        orderer_user_id: uuid.UUID | None = None,
        walk_in_customer_id: uuid.UUID | None = None,
        notes: str | None = None,
    ) -> Order:
        """Buyurtma yaratish.

        Args:
            created_by_user_id: kim yaratdi (orderer yoki warehouse)
            lines: buyurtma qatorlari
            orderer_user_id: agar self-service bo'lsa
            walk_in_customer_id: agar walk-in bo'lsa

        Raises:
            ValidationError: ikkalasi ham null yoki ikkalasi ham to'lgan
        """
        # Validatsiya: faqat bittasi to'lgan bo'lishi shart
        if bool(orderer_user_id) == bool(walk_in_customer_id):
            raise ValidationError(
                message="Buyurtmachi yoki walk-in customer'dan biri belgilanishi shart"
            )

        if not lines:
            raise ValidationError(message="Buyurtmada kamida 1 ta qator bo'lishi shart")

        # Order
        source = (
            OrderSource.SELF_VIA_BOT
            if orderer_user_id
            else OrderSource.ON_BEHALF_WALKIN
        )

        order = Order(
            orderer_user_id=orderer_user_id,
            walk_in_customer_id=walk_in_customer_id,
            source=source.value,
            created_by_user_id=created_by_user_id,
            status=OrderStatus.PENDING_SOURCING.value,
            notes=notes,
        )
        self.session.add(order)
        await self.session.flush()

        # Order lines
        for line_input in lines:
            if line_input.quantity <= 0:
                raise ValidationError(message="Miqdor 0 dan katta bo'lishi shart")

            line = OrderLine(
                order_id=order.id,
                sourcing_spec_id=line_input.sourcing_spec_id,
                quantity=line_input.quantity,
                target_unit_weight_g=line_input.target_unit_weight_g,
                color=line_input.color,
                notes=line_input.notes,
                customer_paid_amount=line_input.customer_paid_amount,
                customer_paid_currency=line_input.customer_paid_currency,
                fulfillment_status=FulfillmentStatus.PENDING_SOURCING.value,
            )
            self.session.add(line)

        await self.session.flush()
        return order
