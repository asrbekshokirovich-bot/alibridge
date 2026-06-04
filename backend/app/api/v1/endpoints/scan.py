"""Scan endpoint — barkod skanerlash.

Invariant 4 — har bir scan alohida tx.

Qo'llab-quvvatlanadigan context'lar:
  CARRIER_RECEIVE   — COURIER_UZ → CARRIER     (carrier tomonidan qabul)
  COURIER_TR_RECEIVE— CARRIER    → COURIER_TR  (turkiya kuryeri qabul)
  WAREHOUSE_TR_IN   — COURIER_TR → TR_WH       (turkiya ombori qabul)
  CHINA_RECEIVE     — IN_TRANSIT_CN_UZ → TASHKENT_WH (toshkent ombori xitoy jo'natmasini qabul)
"""

from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user, require_role
from app.api.deps.db import get_db_session
from app.core.config import settings
from app.domain.enums import CustodyEventType, HandoffStatus, HolderType, ProductStatus, Role
from app.infra.db.models.carrier import CarrierPick
from app.infra.db.models.custody import CustodyEvent
from app.infra.db.models.product import Product
from app.infra.db.models.user import User
from app.infra.qr.signer import InvalidQrPayloadError, QrSigner
from app.services.scan_handoff import ScanHandoffService

router = APIRouter()


class ScanRequest(BaseModel):
    qr_payload: str
    context: Literal["CARRIER_RECEIVE", "COURIER_TR_RECEIVE", "WAREHOUSE_TR_IN", "CHINA_RECEIVE"] | None = None
    to_holder_type: HolderType | None = None
    to_holder_id: uuid.UUID | None = None
    event_type: CustodyEventType | None = None
    session_id: uuid.UUID | None = None
    seal_number: str | None = None
    handoff_code: str | None = None
    photo_url: str | None = None


class ScanResponse(BaseModel):
    event_id: uuid.UUID | None = None
    product_id: uuid.UUID | None = None
    new_status: str
    carrier_name: str | None = None
    short_code: str | None = None
    new_holder_type: str | None = None
    pick_id: str | None = None


# ── Helper: QR decode ─────────────────────────────────────────────────────────

def _decode_qr(signer: QrSigner, payload: str) -> uuid.UUID:
    try:
        return signer.decode(payload)
    except InvalidQrPayloadError:
        raise HTTPException(status_code=400, detail="Noto'g'ri QR kod")


@router.post("", response_model=ScanResponse)
async def scan_handoff(
    body: ScanRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ScanResponse:
    """Bitta paketni skanerlash.

    context='CARRIER_RECEIVE'    : courier_uz → carrier   (faqat CARRIER roli)
    context='COURIER_TR_RECEIVE' : carrier    → courier_tr (faqat COURIER_TR roli)
    context='WAREHOUSE_TR_IN'    : courier_tr → tr_wh      (faqat WAREHOUSE_TR roli)
    Generic: to_holder_type + event_type talab qilinadi.
    """
    from app.repositories.user_repo import UserRepository
    user_roles = await UserRepository(session).get_roles(user.id)
    qr_signer = QrSigner(secret=settings.qr_hmac_secret)

    # ── CARRIER_RECEIVE: ombordan yoki courier_uz'dan carrier'ga ────────────
    if body.context == "CARRIER_RECEIVE":
        if Role.CARRIER not in user_roles:
            raise HTTPException(status_code=403, detail="Faqat yo'lovchilar (carrier) skanerlashi mumkin")

        product_id = _decode_qr(qr_signer, body.qr_payload)
        product = await session.get(Product, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Mahsulot topilmadi")

        if product.status == ProductStatus.WITH_COURIER_UZ.value:
            # Klassik oqim: UZ kuryer → carrier
            from_holder_type = HolderType.COURIER_UZ.value
            old_holder_id = product.custody_holder_id
            pick = None

        elif product.status in (
            ProductStatus.AT_TASHKENT_WH.value,
            ProductStatus.IN_BASKET.value,
        ):
            # Ombor pickup: carrier spec bo'yicha tanlagan mahsulotni skanerlaydi.
            # Skanerlangan product savatdagi bilan bir xil product_id bo'lmasligi mumkin —
            # muhimi bir xil sourcing_spec bo'lsin.
            from sqlalchemy.orm import aliased
            PickProduct = aliased(Product)

            pick = (await session.execute(
                select(CarrierPick)
                .join(PickProduct, CarrierPick.product_id == PickProduct.id)
                .where(
                    CarrierPick.carrier_user_id == user.id,
                    CarrierPick.handoff_status.in_([
                        HandoffStatus.IN_BASKET.value,
                        HandoffStatus.AWAITING_HANDOFF.value,
                    ]),
                    PickProduct.sourcing_spec_id == product.sourcing_spec_id,
                )
            )).scalars().first()

            if not pick:
                raise HTTPException(
                    status_code=400,
                    detail="Bu turdagi mahsulot sizning savatingizda yo'q",
                )

            # Agar savatdagi product boshqa bo'lsa — uni qaytarib qo'yamiz
            if pick.product_id != product.id:
                original = await session.get(Product, pick.product_id)
                if original and original.status == ProductStatus.IN_BASKET.value:
                    original.status = ProductStatus.AT_TASHKENT_WH.value
                # Pick ni skanerlangan productga ko'chirish
                pick.product_id = product.id

            from_holder_type = HolderType.TASHKENT_WH.value
            old_holder_id = product.custody_holder_id
            pick.handoff_status = HandoffStatus.CARRIER_HAS_CUSTODY.value
            pick.basket_lock_until = None

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Mahsulot bu amaliyot uchun noto'g'ri statusda: {product.status}",
            )

        product.status = ProductStatus.WITH_CARRIER.value
        product.custody_holder_type = HolderType.CARRIER.value
        product.custody_holder_id = user.id

        event = CustodyEvent(
            id=uuid.uuid4(),
            product_id=product.id,
            event_type=CustodyEventType.DELIVERED_TO_CARRIER.value,
            from_holder_type=from_holder_type,
            from_holder_id=old_holder_id,
            to_holder_type=HolderType.CARRIER.value,
            to_holder_id=user.id,
            actor_user_id=user.id,
        )
        session.add(event)
        await session.commit()

        return ScanResponse(
            event_id=event.id,
            product_id=product.id,
            new_status=product.status,
            short_code=product.short_code,
            new_holder_type=HolderType.CARRIER.value,
        )

    # ── COURIER_TR_RECEIVE: carrier → courier_tr ─────────────────────────────
    if body.context == "COURIER_TR_RECEIVE":
        # CRIT-4 fix: faqat COURIER_TR roli skanerlashi mumkin
        if Role.COURIER_TR not in user_roles:
            raise HTTPException(status_code=403, detail="Faqat Turkiya kuryer skanerlashi mumkin")

        product_id = _decode_qr(qr_signer, body.qr_payload)
        product = await session.get(Product, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Mahsulot topilmadi")
        if product.status != ProductStatus.WITH_CARRIER.value:
            raise HTTPException(
                status_code=400,
                detail="Mahsulot hozirda yo'lovchida emas",
            )

        # Carrier pick va carrier ismini topish
        pick = (await session.execute(
            select(CarrierPick).where(CarrierPick.product_id == product.id)
        )).scalars().first()

        carrier_name = ""
        if pick:
            carrier_user = await session.get(User, pick.carrier_user_id)
            carrier_name = carrier_user.full_name or "" if carrier_user else ""

        old_holder_id = product.custody_holder_id
        product.status = ProductStatus.WITH_COURIER_TR.value
        product.custody_holder_type = HolderType.COURIER_TR.value
        product.custody_holder_id = user.id

        event = CustodyEvent(
            id=uuid.uuid4(),
            product_id=product.id,
            event_type=CustodyEventType.HANDED_TO_TR_COURIER.value,
            from_holder_type=HolderType.CARRIER.value,
            from_holder_id=old_holder_id,
            to_holder_type=HolderType.COURIER_TR.value,
            to_holder_id=user.id,
            actor_user_id=user.id,
        )
        session.add(event)
        await session.commit()

        return ScanResponse(
            event_id=event.id,
            product_id=product.id,
            new_status=product.status,
            short_code=product.short_code,
            new_holder_type=HolderType.COURIER_TR.value,
            carrier_name=carrier_name,
        )

    # ── WAREHOUSE_TR_IN: courier_tr → tr_wh ──────────────────────────────────
    if body.context == "WAREHOUSE_TR_IN":
        # CRIT-4 fix: faqat WAREHOUSE_TR roli skanerlashi mumkin
        if Role.WAREHOUSE_TR not in user_roles:
            raise HTTPException(status_code=403, detail="Faqat Turkiya ombor xodimi skanerlashi mumkin")

        product_id = _decode_qr(qr_signer, body.qr_payload)
        product = await session.get(Product, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Mahsulot topilmadi")
        if product.status != ProductStatus.WITH_COURIER_TR.value:
            raise HTTPException(
                status_code=400,
                detail="Mahsulot hozirda Turkiya kuryerida emas",
            )

        # CarrierPick handoff statusini yangilash
        pick = (await session.execute(
            select(CarrierPick).where(CarrierPick.product_id == product.id)
        )).scalars().first()

        carrier_name = ""
        if pick:
            from datetime import datetime, timezone
            carrier_user = await session.get(User, pick.carrier_user_id)
            carrier_name = carrier_user.full_name or "" if carrier_user else ""
            pick.handoff_status = HandoffStatus.DROPPED_OFF.value
            pick.payout_eligible_at = datetime.now(timezone.utc)

        old_holder_id = product.custody_holder_id
        product.status = ProductStatus.AT_TR_WH.value
        product.custody_holder_type = HolderType.TR_WH.value
        product.custody_holder_id = user.id

        event = CustodyEvent(
            id=uuid.uuid4(),
            product_id=product.id,
            event_type=CustodyEventType.HANDED_TO_TR_WH.value,
            from_holder_type=HolderType.COURIER_TR.value,
            from_holder_id=old_holder_id,
            to_holder_type=HolderType.TR_WH.value,
            to_holder_id=user.id,
            actor_user_id=user.id,
        )
        session.add(event)
        await session.commit()

        return ScanResponse(
            event_id=event.id,
            product_id=product.id,
            new_status=ProductStatus.AT_TR_WH.value,
            carrier_name=carrier_name,
            short_code=product.short_code,
            new_holder_type=HolderType.TR_WH.value,
            pick_id=str(pick.id) if pick else "",
        )

    # ── CHINA_RECEIVE: in_transit_cn_uz → tashkent_wh ────────────────────────
    if body.context == "CHINA_RECEIVE":
        if Role.WAREHOUSE_UZ not in user_roles:
            raise HTTPException(status_code=403, detail="Faqat Toshkent ombor xodimi skanerlashi mumkin")

        product_id = _decode_qr(qr_signer, body.qr_payload)
        product = await session.get(Product, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Mahsulot topilmadi")
        if product.status != ProductStatus.IN_TRANSIT_CN_UZ.value:
            raise HTTPException(
                status_code=400,
                detail="Mahsulot Xitoydan yo'lda emas",
            )

        old_holder_id = product.custody_holder_id
        product.status = ProductStatus.AT_TASHKENT_WH.value
        product.custody_holder_type = HolderType.TASHKENT_WH.value
        product.custody_holder_id = None

        event = CustodyEvent(
            id=uuid.uuid4(),
            product_id=product.id,
            event_type=CustodyEventType.RECEIVED_AT_TASHKENT.value,
            from_holder_type=HolderType.IN_TRANSIT_CN_UZ.value,
            from_holder_id=old_holder_id,
            to_holder_type=HolderType.TASHKENT_WH.value,
            to_holder_id=None,
            actor_user_id=user.id,
        )
        session.add(event)
        await session.commit()

        return ScanResponse(
            event_id=event.id,
            product_id=product.id,
            new_status=product.status,
            short_code=product.short_code,
            new_holder_type=HolderType.TASHKENT_WH.value,
        )

    # ── Generic scan (faqat admin) ────────────────────────────────────────────
    if Role.ADMIN not in user_roles:
        raise HTTPException(
            status_code=403,
            detail="Noto'g'ri yoki ruxsatsiz scan context",
        )

    if not body.to_holder_type or not body.event_type:
        raise HTTPException(
            status_code=422,
            detail="to_holder_type va event_type talab qilinadi",
        )

    service = ScanHandoffService(session, qr_signer=qr_signer)
    event = await service.scan_one(
        qr_payload=body.qr_payload,
        actor_user_id=user.id,
        to_holder_type=body.to_holder_type,
        to_holder_id=body.to_holder_id,
        event_type=body.event_type,
        session_id=body.session_id,
        seal_number=body.seal_number,
        handoff_code=body.handoff_code,
        photo_url=body.photo_url,
    )

    return ScanResponse(
        event_id=event.id,
        product_id=event.product_id,
        new_status=body.to_holder_type.value,
    )
