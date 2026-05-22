"""
Carrier onboarding service — Invariant 5: Dual confirmation.
DEV_PLAN §6.2

Bosqichlar:
1. OTP telefon tasdiqlash
2. Passport OCR + manual review
3. Selfie tekshiruvi
4. Aviabilet OCR (parvoz ma'lumotlari)
5. Carrier o'zi tasdiqlaydi (Confirm 1)
6. Admin/tizim tasdiqlaydi (Confirm 2)

Invariant 5: Ikkala tasdiqlash bo'lmagunicha carrier faol emas.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.db.models.carrier import CarrierProfile, Route
from app.infra.db.models.user import User
from app.domain.enums import TrustTier, OnboardingChannel
from app.core.exceptions import (
    CarrierOnboardingError,
    OcrFailedError,
    TicketParseError,
)


@dataclass
class OnboardingData:
    """Carrier onboarding davomida to'plangan ma'lumotlar."""
    carrier_id: str
    passport_s3_key: str
    selfie_s3_key: str
    ticket_s3_key: str
    passport_name: str
    passport_number: str
    passport_expiry: date
    flight_origin: str
    flight_destination: str
    flight_date: date
    flight_number: str
    phone_number: str
    phone_verified: bool
    carrier_confirmed: bool = False  # Confirm 1
    system_approved: bool = False    # Confirm 2 (Invariant 5)


class OnboardCarrierService:
    def __init__(
        self,
        session: AsyncSession,
        ocr_passport,
        ocr_ticket,
        s3_storage,
        sms_client,
    ) -> None:
        self._session = session
        self._ocr_passport = ocr_passport
        self._ocr_ticket = ocr_ticket
        self._s3 = s3_storage
        self._sms = sms_client

    async def process_passport(
        self, carrier_id: str, image_bytes: bytes
    ) -> dict:
        """
        Passport rasmi OCR orqali o'qiladi.
        Muvaffaqiyatsiz bo'lsa OcrFailedError ko'tariladi.
        """
        s3_key = f"passports/{carrier_id}/{uuid.uuid4()}.jpg"
        await self._s3.upload(s3_key, image_bytes, content_type="image/jpeg")

        try:
            result = await self._ocr_passport.recognize(image_bytes)
        except Exception as e:
            raise OcrFailedError(f"Passport OCR failed: {e}") from e

        return {
            "s3_key": s3_key,
            "name": result.full_name,
            "number": result.document_number,
            "expiry": result.expiry_date,
        }

    async def process_ticket(
        self, carrier_id: str, image_bytes: bytes
    ) -> dict:
        """
        Aviabilet rasmi OCR orqali o'qiladi.
        Ko'p segmentli reyslar uchun birinchi va so'nggi leg ishlatiladi.
        """
        s3_key = f"tickets/{carrier_id}/{uuid.uuid4()}.jpg"
        await self._s3.upload(s3_key, image_bytes, content_type="image/jpeg")

        try:
            result = await self._ocr_ticket.recognize(image_bytes)
        except Exception as e:
            raise TicketParseError(f"Ticket OCR failed: {e}") from e

        if not result.legs:
            raise TicketParseError("No flight legs found in ticket")

        first_leg = result.legs[0]
        last_leg = result.legs[-1]

        return {
            "s3_key": s3_key,
            "origin": first_leg.origin,
            "destination": last_leg.destination,
            "date": first_leg.departure_date,
            "flight_number": first_leg.flight_number,
        }

    async def carrier_confirm(
        self,
        carrier_id: str,
        onboarding_data: OnboardingData,
    ) -> CarrierProfile:
        """
        Invariant 5, Confirm 1: Carrier o'z ma'lumotlarini tasdiqlaydi.
        Bu qadam carrier profilini yaratadi (pending holatida).
        """
        if not onboarding_data.phone_verified:
            raise CarrierOnboardingError("Phone must be verified before confirming")

        # Carrier profili yaratish (hali faol emas)
        profile = CarrierProfile(
            id=str(uuid.uuid4()),
            user_id=carrier_id,
            passport_s3_key=onboarding_data.passport_s3_key,
            selfie_s3_key=onboarding_data.selfie_s3_key,
            ticket_s3_key=onboarding_data.ticket_s3_key,
            passport_name=onboarding_data.passport_name,
            passport_number=onboarding_data.passport_number,
            passport_expiry=onboarding_data.passport_expiry,
            trust_tier=TrustTier.NEW,
            kg_limit=5000,  # Yangi carrier: 5 kg limit (DEV_PLAN §6.4)
            is_active=False,  # Admin tasdiqlagunicha faol emas
            onboarding_channel=OnboardingChannel.TELEGRAM,
        )
        self._session.add(profile)

        # Reys marshruti
        route = Route(
            id=str(uuid.uuid4()),
            carrier_id=profile.id,
            origin=onboarding_data.flight_origin,
            destination=onboarding_data.flight_destination,
            departure_date=onboarding_data.flight_date,
            flight_number=onboarding_data.flight_number,
        )
        self._session.add(route)
        await self._session.flush()

        return profile

    async def system_approve(
        self,
        profile_id: str,
        approved_by_user_id: str,
    ) -> CarrierProfile:
        """
        Invariant 5, Confirm 2: Admin/tizim carrier profilini faollashtiradi.
        Bu qadomdan keyin carrier catalog'ni ko'rishi va pick qilishi mumkin.
        """
        from sqlalchemy import select
        from datetime import datetime, timezone

        stmt = select(CarrierProfile).where(CarrierProfile.id == profile_id)
        result = await self._session.execute(stmt)
        profile = result.scalar_one()

        profile.is_active = True
        profile.liability_consented_at = datetime.now(timezone.utc)
        await self._session.flush()

        return profile
