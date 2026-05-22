"""Carrier repository."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.domain.enums import HandoffStatus, TrustTier
from app.infra.db.models.carrier import CarrierPick, CarrierProfile, Route
from app.repositories.base import BaseRepository


class CarrierProfileRepository(BaseRepository[CarrierProfile]):
    model = CarrierProfile

    async def get_by_user_id(self, user_id: uuid.UUID) -> CarrierProfile | None:
        """Carrier profilini olish."""
        result = await self.session.execute(
            select(CarrierProfile)
            .options(selectinload(CarrierProfile.user))
            .where(CarrierProfile.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def upsert(
        self,
        *,
        user_id: uuid.UUID,
        **fields,
    ) -> CarrierProfile:
        """Profil yaratish yoki yangilash."""
        existing = await self.get_by_user_id(user_id)
        if existing:
            for key, value in fields.items():
                setattr(existing, key, value)
            await self.session.flush()
            return existing

        profile = CarrierProfile(user_id=user_id, **fields)
        self.session.add(profile)
        await self.session.flush()
        return profile

    async def get_pending_landings(self, hours_since_arrival: int) -> list[CarrierProfile]:
        """Qo'ngan, lekin manzil bermagan carrier'lar (escalation uchun)."""
        from datetime import datetime, timedelta, timezone

        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours_since_arrival)

        result = await self.session.execute(
            select(CarrierProfile)
            .where(CarrierProfile.arrive_at <= cutoff)
            .where(CarrierProfile.landing_reported_at.is_(None))
            .where(CarrierProfile.blacklisted_at.is_(None))
        )
        return list(result.scalars().all())


class CarrierPickRepository(BaseRepository[CarrierPick]):
    model = CarrierPick

    async def get_basket(self, carrier_user_id: uuid.UUID) -> list[CarrierPick]:
        """Carrier'ning aktiv korzinasi."""
        result = await self.session.execute(
            select(CarrierPick)
            .options(selectinload(CarrierPick.product))
            .where(CarrierPick.carrier_user_id == carrier_user_id)
            .where(CarrierPick.handoff_status == HandoffStatus.IN_BASKET.value)
        )
        return list(result.scalars().all())

    async def get_my_picks(
        self,
        carrier_user_id: uuid.UUID,
        *,
        statuses: list[HandoffStatus] | None = None,
    ) -> list[CarrierPick]:
        """Carrier'ning barcha pick'lari (tarix)."""
        query = (
            select(CarrierPick)
            .options(selectinload(CarrierPick.product))
            .where(CarrierPick.carrier_user_id == carrier_user_id)
        )
        if statuses:
            query = query.where(CarrierPick.handoff_status.in_([s.value for s in statuses]))

        result = await self.session.execute(query.order_by(CarrierPick.picked_at.desc()))
        return list(result.scalars().all())


class RouteRepository(BaseRepository[Route]):
    model = Route

    async def find_route(
        self,
        *,
        depart_iata: str,
        arrive_iata: str,
        airline: str | None = None,
    ) -> Route | None:
        """Route topish (airline'ga moslashuv, agar bo'lsa)."""
        # Avval aniq airline bilan
        if airline:
            result = await self.session.execute(
                select(Route)
                .where(Route.depart_iata == depart_iata)
                .where(Route.arrive_iata == arrive_iata)
                .where(Route.airline == airline)
                .where(Route.active.is_(True))
            )
            route = result.scalar_one_or_none()
            if route:
                return route

        # Keyin umumiy (airline=null)
        result = await self.session.execute(
            select(Route)
            .where(Route.depart_iata == depart_iata)
            .where(Route.arrive_iata == arrive_iata)
            .where(Route.airline.is_(None))
            .where(Route.active.is_(True))
        )
        return result.scalar_one_or_none()
