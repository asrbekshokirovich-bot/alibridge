"""Catalog endpoint — carrier, warehouse_uz, admin uchun mavjud mahsulotlar."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select, text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.api.deps.db import get_db_session
from app.domain.enums import HandoffStatus, TrustTier
from app.infra.db.models.carrier import CarrierPick
from app.infra.db.models.product import Product
from app.infra.db.models.user import User
from app.repositories.carrier_repo import CarrierProfileRepository

router = APIRouter()


class CatalogSpecItem(BaseModel):
    spec_id: uuid.UUID
    title: str
    category: str | None
    photos: list[str]
    available_count: int
    basket_count: int
    last_pick_id: str | None
    min_weight_g: int
    min_price: str
    currency: str


class CatalogSpecsResponse(BaseModel):
    specs: list[CatalogSpecItem]
    available_weight_g: int


@router.get("/specs", response_model=CatalogSpecsResponse)
async def list_catalog_specs(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> CatalogSpecsResponse:
    """Spec guruhlangan katalog — carrier, warehouse_uz, admin uchun."""
    from app.domain.enums import Role
    from app.repositories.user_repo import UserRepository

    user_repo = UserRepository(session)
    user_roles = await user_repo.get_roles(user.id)
    is_carrier = Role.CARRIER in user_roles

    available_weight_g = 0
    basket_by_spec: dict[str, list[str]] = {}

    if is_carrier:
        carrier_repo = CarrierProfileRepository(session)
        profile = await carrier_repo.get_by_user_id(user.id)
        if profile is None:
            from app.core.exceptions import ForbiddenError
            raise ForbiddenError(message="Avval carrier sifatida ro'yxatdan o'ting")

        # Barcha aktiv pick'lar vaznini ayirish (yetkazilmaganlar)
        active_pick_statuses = [
            HandoffStatus.IN_BASKET.value,
            HandoffStatus.AWAITING_HANDOFF.value,
            HandoffStatus.CARRIER_HAS_CUSTODY.value,
            HandoffStatus.IN_FLIGHT.value,
        ]
        used_weight_result = await session.execute(
            select(func.coalesce(func.sum(Product.unit_weight_g), 0))
            .join(CarrierPick, CarrierPick.product_id == Product.id)
            .where(
                CarrierPick.carrier_user_id == user.id,
                CarrierPick.handoff_status.in_(active_pick_statuses),
            )
        )
        used_weight_g = int(used_weight_result.scalar_one() or 0)
        total_weight_g = int(profile.allowed_kg * 1000)
        available_weight_g = max(0, total_weight_g - used_weight_g)

        basket_rows = (await session.execute(sa_text("""
            SELECT cp.id as pick_id, p.sourcing_spec_id
            FROM carrier_picks cp
            JOIN products p ON p.id = cp.product_id
            WHERE cp.carrier_user_id = :uid
              AND cp.handoff_status = 'in_basket'
            ORDER BY cp.picked_at ASC
        """), {"uid": user.id})).fetchall()

        for row in basket_rows:
            sid = str(row.sourcing_spec_id)
            basket_by_spec.setdefault(sid, []).append(str(row.pick_id))

    rows = (await session.execute(sa_text("""
        SELECT
            ss.id          AS spec_id,
            ss.title,
            ss.category,
            ss.photos,
            COUNT(p.id)    AS available_count,
            MIN(p.unit_weight_g)              AS min_weight_g,
            MIN(p.cargo_price_uz_to_tr)       AS min_price,
            MAX(p.cargo_currency)             AS currency
        FROM sourcing_specs ss
        JOIN products p ON p.sourcing_spec_id = ss.id
        WHERE p.status = 'at_tashkent_wh'
        GROUP BY ss.id, ss.title, ss.category, ss.photos
        ORDER BY MAX(p.created_at) DESC
    """))).fetchall()

    specs = []
    for r in rows:
        sid = str(r.spec_id)
        picks = basket_by_spec.get(sid, [])
        photos: list[str] = list(r.photos) if r.photos else []
        specs.append(CatalogSpecItem(
            spec_id=r.spec_id,
            title=r.title,
            category=r.category,
            photos=photos,
            available_count=int(r.available_count),
            basket_count=len(picks),
            last_pick_id=picks[-1] if picks else None,
            min_weight_g=int(r.min_weight_g or 0),
            min_price=str(r.min_price or "0"),
            currency=r.currency or "UZS",
        ))

    return CatalogSpecsResponse(specs=specs, available_weight_g=available_weight_g)
