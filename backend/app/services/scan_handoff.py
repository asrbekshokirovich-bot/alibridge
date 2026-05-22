"""Scan handoff service — Invariant 4 ⭐

BIR SKAN = BIR TRANZAKSIYA.

Session 30 ta itemdan 18-tasida crash bo'lsa, 18 ta saqlanadi.
Carrier 19-itemdan davom etadi.

Hech qachon 'transactional all-or-nothing session' qilmaymiz.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ForbiddenError,
    InvalidCustodyTransitionError,
    NotFoundError,
)
from app.core.logger import get_logger
from app.domain.enums import CustodyEventType, HolderType, ProductStatus
from app.domain.state_machines import CustodyStateMachine
from app.infra.db.models.custody import CustodyEvent
from app.infra.db.models.product import Product
from app.infra.qr.signer import QrSigner

log = get_logger(__name__)


class ScanHandoffService:
    """Bitta skanerlashni atomic ravishda boshqarish."""

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

    async def scan_one(
        self,
        *,
        qr_payload: str,
        actor_user_id: uuid.UUID,
        to_holder_type: HolderType,
        to_holder_id: uuid.UUID | None,
        event_type: CustodyEventType,
        session_id: uuid.UUID | None = None,
        seal_number: str | None = None,
        handoff_code: str | None = None,
        photo_url: str | None = None,
    ) -> CustodyEvent:
        """Bitta paketni skanerlash + custody yangilash (atomic).

        Steps:
        1. QR payload tekshirish va product_id chiqarish
        2. Product'ni topish
        3. State machine validatsiyasi
        4. CustodyEvent yaratish (INSERT)
        5. Product.custody_holder_* yangilash
        6. COMMIT (chaqiruvchi qiladi)

        Raises:
            InvalidQrPayloadError: QR yaroqsiz
            NotFoundError: product topilmadi
            InvalidCustodyTransitionError: holat o'tishi noto'g'ri
        """
        # 1. QR'ni dekodlash
        product_id = self.qr_signer.decode(qr_payload)

        # 2. Product topish
        product = await self.session.get(Product, product_id)
        if product is None:
            raise NotFoundError(message="Mahsulot topilmadi")

        # 3. State machine validatsiyasi
        try:
            from_holder = HolderType(product.custody_holder_type)
        except ValueError:
            from_holder = None

        self.state_machine.validate_transition(
            from_holder=from_holder,
            to_holder=to_holder_type,
            event_type=event_type,
        )

        # 4. CustodyEvent yaratish (append-only)
        event = CustodyEvent(
            product_id=product.id,
            event_type=event_type.value,
            from_holder_type=product.custody_holder_type,
            from_holder_id=product.custody_holder_id,
            to_holder_type=to_holder_type.value,
            to_holder_id=to_holder_id,
            actor_user_id=actor_user_id,
            session_id=session_id,
            seal_number=seal_number,
            handoff_code=handoff_code,
            photo_url=photo_url,
            at=datetime.now(timezone.utc),
        )
        self.session.add(event)

        # 5. Product cache yangilash (denormalized)
        product.custody_holder_type = to_holder_type.value
        product.custody_holder_id = to_holder_id

        # Product status mapping (holder → status)
        product.status = _holder_to_status(to_holder_type).value

        await self.session.flush()

        log.info(
            "scan_committed",
            product_id=str(product.id),
            from_holder=str(from_holder),
            to_holder=str(to_holder_type),
            event_type=event_type.value,
            actor=str(actor_user_id),
        )

        return event


def _holder_to_status(holder: HolderType) -> ProductStatus:
    """Holder'dan product status'iga mapping."""
    mapping = {
        HolderType.TASHKENT_WH: ProductStatus.AT_TASHKENT_WH,
        HolderType.COURIER_UZ: ProductStatus.WITH_COURIER_UZ,
        HolderType.YANDEX_BRIDGE: ProductStatus.WITH_COURIER_UZ,  # Yandex ~ courier
        HolderType.CARRIER: ProductStatus.WITH_CARRIER,
        HolderType.COURIER_TR: ProductStatus.WITH_COURIER_TR,
        HolderType.TR_WH: ProductStatus.AT_TR_WH,
        HolderType.ORDERER: ProductStatus.DELIVERED,
        HolderType.ORDERER_WALKIN: ProductStatus.DELIVERED,
        HolderType.LOST: ProductStatus.LOST,
    }
    return mapping.get(holder, ProductStatus.AT_TASHKENT_WH)
