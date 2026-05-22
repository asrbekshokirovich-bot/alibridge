"""
Intake shipment service — Warehouse UZ'da tovarlarni qabul qilish.
DEV_PLAN §9.1

Farqlar (discrepancy) boshqarish:
- OK: kutilgan miqdor keldi
- SHORT: kam keldi — buyurtmachi xabardor qilinadi
- OVER: ko'p keldi — ortiqcha qaytarib yuboriladi
"""
from __future__ import annotations

import random
import string
import uuid
from dataclasses import dataclass
from decimal import Decimal
from enum import Enum
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.db.models.order import Order, OrderLine, SourcingSpec
from app.infra.db.models.custody import CustodyEvent
from app.domain.enums import (
    CustodyEventType,
    FulfillmentStatus,
    HolderType,
    ProductStatus,
)


class DiscrepancyType(str, Enum):
    OK = "OK"
    SHORT = "SHORT"
    OVER = "OVER"
    WRONG = "WRONG"


@dataclass
class IntakeLineResult:
    line_id: str
    spec_title: str
    expected: int
    received: int
    discrepancy: DiscrepancyType


@dataclass
class IntakeResult:
    order_id: str
    lines: List[IntakeLineResult]
    has_discrepancy: bool
    total_products_created: int


class IntakeShipmentService:
    def __init__(self, session: AsyncSession, notifier=None) -> None:
        self._session = session
        self._notifier = notifier  # Telegram notification service (optional)

    async def process(
        self,
        *,
        order_id: str,
        warehouse_worker_id: str,
        line_counts: List[dict],  # [{"line_id": str, "count_received": int}]
    ) -> IntakeResult:
        """
        Buyurtmani qabul qilish jarayoni:
        1. Har bir qator uchun haqiqiy miqdor kiritiladi
        2. Farqlar aniqlanadi
        3. Mahsulot passportlari yaratiladi (count_received dona)
        4. Custody eventlar yoziladi (CREATED, from=None -> to=TASHKENT_WH)
        5. Farq bo'lsa buyurtmachi xabardor qilinadi
        """
        # Order ni olish
        order_stmt = select(Order).where(Order.id == uuid.UUID(order_id))
        order = (await self._session.execute(order_stmt)).scalar_one()

        # OrderLine'larni SourcingSpec title bilan JOIN qilib olish
        lines_stmt = (
            select(OrderLine, SourcingSpec.title.label("spec_title"))
            .outerjoin(SourcingSpec, OrderLine.sourcing_spec_id == SourcingSpec.id)
            .where(OrderLine.order_id == uuid.UUID(order_id))
        )
        lines_rows = (await self._session.execute(lines_stmt)).all()

        count_map = {lc["line_id"]: lc["count_received"] for lc in line_counts}
        worker_uuid = uuid.UUID(warehouse_worker_id)

        # Circular import'dan qochish uchun ichida import
        from app.infra.db.models.product import Product
        from app.infra.qr.signer import QrSigner
        from app.core.config import settings

        signer = QrSigner(secret=settings.qr_hmac_secret)

        line_results: List[IntakeLineResult] = []
        total_products = 0
        has_discrepancy = False

        for order_line, spec_title in lines_rows:
            line_id = str(order_line.id)
            count_received = count_map.get(line_id, 0)
            expected = order_line.quantity

            # Farqni aniqlash
            if count_received == expected:
                discrepancy = DiscrepancyType.OK
                fulfillment = FulfillmentStatus.RECEIVED_FULL
            elif count_received < expected:
                discrepancy = DiscrepancyType.SHORT
                fulfillment = FulfillmentStatus.RECEIVED_PARTIAL
                has_discrepancy = True
            else:  # count_received > expected
                discrepancy = DiscrepancyType.OVER
                fulfillment = FulfillmentStatus.RECEIVED_OVER
                has_discrepancy = True

            # OrderLine'ni yangilash
            order_line.count_received = count_received
            order_line.fulfillment_status = fulfillment.value
            await self._session.flush()

            # Qabul qilingan miqdorda mahsulot passportlari yaratish
            products_to_create = min(count_received, expected)
            for _ in range(products_to_create):
                product_id = uuid.uuid4()
                short_code = self._generate_short_code()
                qr_payload = signer.encode(product_id)

                product = Product(
                    id=product_id,
                    sourcing_spec_id=order_line.sourcing_spec_id,
                    order_line_id=order_line.id,
                    short_code=short_code,
                    qr_payload=qr_payload,
                    barcode_payload=short_code,
                    unit_weight_g=order_line.target_unit_weight_g or 500,
                    cargo_price_uz_to_tr=Decimal("0"),
                    status=ProductStatus.AT_TASHKENT_WH.value,
                    custody_holder_type=HolderType.TASHKENT_WH.value,
                    custody_holder_id=worker_uuid,
                )
                self._session.add(product)

                # Custody event — CREATED (birinchi event, oldingi holder yo'q)
                custody_event = CustodyEvent(
                    id=uuid.uuid4(),
                    product_id=product_id,
                    event_type=CustodyEventType.CREATED.value,
                    from_holder_type=None,
                    from_holder_id=None,
                    to_holder_type=HolderType.TASHKENT_WH.value,
                    to_holder_id=worker_uuid,
                    actor_user_id=worker_uuid,
                )
                self._session.add(custody_event)
                total_products += 1

            line_results.append(
                IntakeLineResult(
                    line_id=line_id,
                    spec_title=spec_title or line_id,
                    expected=expected,
                    received=count_received,
                    discrepancy=discrepancy,
                )
            )

        await self._session.flush()

        # Farq bo'lsa buyurtmachi xabardor qilish
        if has_discrepancy and self._notifier:
            await self._notifier.notify_discrepancy(
                orderer_id=order.orderer_user_id or order.walk_in_customer_id,
                order_id=order_id,
                results=line_results,
            )

        return IntakeResult(
            order_id=order_id,
            lines=line_results,
            has_discrepancy=has_discrepancy,
            total_products_created=total_products,
        )

    def _generate_short_code(self) -> str:
        """8 ta alphanumeric kod (I, O, 0, 1 chalkashmasligi uchun chiqarilgan)."""
        chars = "".join(
            c for c in string.ascii_uppercase + string.digits
            if c not in "IO01"
        )
        return "".join(random.choices(chars, k=8))
