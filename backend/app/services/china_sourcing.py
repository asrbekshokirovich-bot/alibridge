"""China sourcing service — sourcing ticket'larni bajarish use case'lari.

China worker mahsulot sotib oladi (Product yaratadi) va Tashkentga jo'natadi.
Har bir custody o'zgarishi state machine bilan validatsiyalanadi (Invariant 1).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.core.security import generate_short_code
from app.domain.enums import (
    CustodyEventType,
    FulfillmentStatus,
    HolderType,
    ProductStatus,
)
from app.domain.state_machines import CustodyStateMachine
from app.infra.db.models.custody import CustodyEvent
from app.infra.db.models.order import OrderLine
from app.infra.db.models.product import Product
from app.infra.qr.signer import QrSigner


class ChinaSourcingService:
    """China worker uchun sourcing use case'lari."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        qr_signer: QrSigner,
        state_machine: CustodyStateMachine | None = None,
    ) -> None:
        self.session = session
        self.qr_signer = qr_signer
        self.state_machine = state_machine or CustodyStateMachine()

    async def source_ticket(
        self,
        *,
        order_line_id: uuid.UUID,
        china_user_id: uuid.UUID,
        count: int,
        unit_weight_g: int,
        color: str | None = None,
        box_items_count: int | None = None,
    ) -> list[Product]:
        """Sourcing ticket'ni bajarish — N ta mahsulot yaratish (CHINA_SUPPLIER).

        Order line PENDING_SOURCING → SOURCING.
        Narx (cargo_price) Tashkent intake'da belgilanadi, bu yerda 0.

        Quti (box) rejimi: `box_items_count` berilsa, har bir Product = bitta quti
        (unit_weight_g = quti umumiy og'irligi, ichida box_items_count dona).
        """
        if count <= 0:
            raise ValidationError(message="Soni 0 dan katta bo'lishi shart")
        if unit_weight_g <= 0:
            raise ValidationError(message="Og'irlik 0 dan katta bo'lishi shart")
        if box_items_count is not None and box_items_count <= 0:
            raise ValidationError(message="Qutidagi dona soni 0 dan katta bo'lishi shart")

        line = await self.session.get(OrderLine, order_line_id)
        if line is None:
            raise NotFoundError(message="Sourcing ticket topilmadi")
        if line.fulfillment_status != FulfillmentStatus.PENDING_SOURCING.value:
            raise ValidationError(message="Bu ticket allaqachon ishlanmoqda")

        # Invariant 1: creation @ China ruxsat etilganligini tasdiqlash
        self.state_machine.validate_transition(
            from_holder=None,
            to_holder=HolderType.CHINA_SUPPLIER,
            event_type=CustodyEventType.CREATED,
        )

        now = datetime.now(timezone.utc)
        created: list[Product] = []
        for _ in range(count):
            product_id = uuid.uuid4()
            short_code = generate_short_code(8)
            qr_payload = self.qr_signer.encode(product_id)
            product = Product(
                id=product_id,
                short_code=short_code,
                order_line_id=line.id,
                sourcing_spec_id=line.sourcing_spec_id,
                unit_weight_g=unit_weight_g,
                color=color or line.color,
                cargo_price_uz_to_tr=Decimal("0"),
                cargo_currency="UZS",
                box_items_count=box_items_count,
                status=ProductStatus.READY_AT_CHINA.value,
                custody_holder_type=HolderType.CHINA_SUPPLIER.value,
                custody_holder_id=china_user_id,
                qr_payload=qr_payload,
                barcode_payload=short_code,
                created_at=now,
            )
            self.session.add(product)
            self.session.add(
                CustodyEvent(
                    product_id=product_id,
                    event_type=CustodyEventType.CREATED.value,
                    from_holder_type=None,
                    to_holder_type=HolderType.CHINA_SUPPLIER.value,
                    to_holder_id=china_user_id,
                    actor_user_id=china_user_id,
                    at=now,
                )
            )
            created.append(product)

        line.fulfillment_status = FulfillmentStatus.SOURCING.value
        await self.session.flush()
        return created

    async def mark_shipped(
        self,
        *,
        product_ids: list[uuid.UUID],
        china_user_id: uuid.UUID,
    ) -> list[Product]:
        """Mahsulotlarni jo'natildi deb belgilash: CHINA_SUPPLIER → IN_TRANSIT_CN_UZ.

        Har bir mahsulot uchun alohida custody event (Invariant 4).
        """
        if not product_ids:
            raise ValidationError(message="Mahsulot tanlanmagan")

        now = datetime.now(timezone.utc)
        shipped: list[Product] = []
        for pid in product_ids:
            product = await self.session.get(Product, pid)
            if product is None:
                raise NotFoundError(message=f"Mahsulot topilmadi: {pid}")
            if product.custody_holder_id != china_user_id:
                raise ForbiddenError(message="Bu mahsulot sizga tegishli emas")
            if product.status != ProductStatus.READY_AT_CHINA.value:
                raise ValidationError(
                    message=f"Mahsulot jo'natishga tayyor emas (holati: {product.status})"
                )

            self.state_machine.validate_transition(
                from_holder=HolderType.CHINA_SUPPLIER,
                to_holder=HolderType.IN_TRANSIT_CN_UZ,
                event_type=CustodyEventType.SHIPPED_FROM_CHINA,
            )

            product.status = ProductStatus.IN_TRANSIT_CN_UZ.value
            product.custody_holder_type = HolderType.IN_TRANSIT_CN_UZ.value
            # holder_id china_user_id da qoladi — jo'natma uchun mas'ul shaxs

            self.session.add(
                CustodyEvent(
                    product_id=product.id,
                    event_type=CustodyEventType.SHIPPED_FROM_CHINA.value,
                    from_holder_type=HolderType.CHINA_SUPPLIER.value,
                    from_holder_id=china_user_id,
                    to_holder_type=HolderType.IN_TRANSIT_CN_UZ.value,
                    to_holder_id=china_user_id,
                    actor_user_id=china_user_id,
                    at=now,
                )
            )
            shipped.append(product)

        await self.session.flush()
        return shipped
