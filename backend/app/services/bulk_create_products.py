"""Bulk product card yaratish — Tashkent intake'da.

Tezlik talabi: 1000 ta mahsulot < 5 sekund (DEV_PLAN §17.4).
Strategiya: bitta tx, batch insert, in-memory QR generation.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationError
from app.core.security import generate_short_code
from app.domain.enums import (
    CustodyEventType,
    HolderType,
    ProductCondition,
    ProductStatus,
)
from app.infra.db.models.custody import CustodyEvent
from app.infra.db.models.product import Product
from app.infra.qr.signer import QrSigner


@dataclass(slots=True)
class IntakeItemInput:
    """Bitta mahsulot uchun intake input."""

    order_line_id: uuid.UUID | None
    sourcing_spec_id: uuid.UUID
    unit_weight_g: int
    cargo_price_uz_to_tr: Decimal
    cargo_currency: str = "UZS"
    color: str | None = None
    condition: ProductCondition = ProductCondition.OK


@dataclass(slots=True)
class CreatedProduct:
    """Yaratilgan mahsulot natijasi (PDF generatsiya uchun)."""

    id: uuid.UUID
    short_code: str
    qr_payload: str
    barcode_payload: str
    title: str  # spec'dan
    unit_weight_g: int
    color: str | None


class BulkCreateProductsService:
    """N ta mahsulotni bitta tx'da yaratish."""

    def __init__(self, session: AsyncSession, *, qr_signer: QrSigner) -> None:
        self.session = session
        self.qr_signer = qr_signer

    async def create_batch(
        self,
        *,
        intake_items: list[IntakeItemInput],
        actor_user_id: uuid.UUID,
        intake_photo_url: str | None = None,
    ) -> list[CreatedProduct]:
        """Mahsulotlarni yaratish + custody_event'lar yozish.

        Steps:
        1. Har bir item uchun UUID, short_code, QR payload yaratish
        2. Product rows INSERT
        3. CustodyEvent 'CREATED' INSERT
        4. Order_line.count_received yangilash
        5. Flush (commit chaqiruvchi tomonidan)

        Returns:
            CreatedProduct ro'yxati (PDF label uchun)
        """
        if not intake_items:
            raise ValidationError(message="Intake bo'sh")

        created: list[CreatedProduct] = []
        now = datetime.now(timezone.utc)

        for item in intake_items:
            product_id = uuid.uuid4()
            short_code = generate_short_code(8)
            qr_payload = self.qr_signer.encode(product_id)
            barcode_payload = short_code  # barcode = short_code (oddiy)

            product = Product(
                id=product_id,
                short_code=short_code,
                order_line_id=item.order_line_id,
                sourcing_spec_id=item.sourcing_spec_id,
                unit_weight_g=item.unit_weight_g,
                color=item.color,
                intake_photo_url=intake_photo_url,
                cargo_price_uz_to_tr=item.cargo_price_uz_to_tr,
                cargo_currency=item.cargo_currency,
                condition_on_intake=item.condition.value,
                status=ProductStatus.AT_TASHKENT_WH.value,
                custody_holder_type=HolderType.TASHKENT_WH.value,
                qr_payload=qr_payload,
                barcode_payload=barcode_payload,
                created_at=now,
            )
            self.session.add(product)

            # Initial custody event
            event = CustodyEvent(
                product_id=product_id,
                event_type=CustodyEventType.CREATED.value,
                from_holder_type=None,
                to_holder_type=HolderType.TASHKENT_WH.value,
                actor_user_id=actor_user_id,
                at=now,
            )
            self.session.add(event)

            # Title aslida sourcing_spec'dan kelishi kerak — bu yerda placeholder
            created.append(
                CreatedProduct(
                    id=product_id,
                    short_code=short_code,
                    qr_payload=qr_payload,
                    barcode_payload=barcode_payload,
                    title="",  # caller to'ldiradi
                    unit_weight_g=item.unit_weight_g,
                    color=item.color,
                )
            )

        await self.session.flush()
        return created
