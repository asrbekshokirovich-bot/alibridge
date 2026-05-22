"""Catalog endpoint — carrier'lar uchun mavjud mahsulotlar."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.api.deps.db import get_db_session
from app.domain.enums import TrustTier
from app.infra.db.models.user import User
from app.repositories.carrier_repo import CarrierProfileRepository
from app.repositories.product_repo import ProductRepository

router = APIRouter()


class CatalogItem(BaseModel):
    id: uuid.UUID
    short_code: str
    spec_title: str
    spec_photos: list
    unit_weight_g: int
    color: str | None
    cargo_price: Decimal
    cargo_currency: str
    created_at: datetime


class CatalogResponse(BaseModel):
    items: list[CatalogItem]
    total: int
    available_weight_g: int


@router.get("", response_model=CatalogResponse)
async def list_catalog(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> CatalogResponse:
    """Carrier uchun filtrlangan katalog.

    Filtr:
    - status = at_tashkent_wh
    - label yopishtirilgan
    - basket'da yo'q
    - carrier'ning qolgan og'irligiga sig'adi
    - LUXURY faqat TRUSTED+ uchun
    """
    # Carrier profil
    carrier_repo = CarrierProfileRepository(session)
    profile = await carrier_repo.get_by_user_id(user.id)
    if profile is None:
        from app.core.exceptions import ForbiddenError

        raise ForbiddenError(message="Avval carrier sifatida ro'yxatdan o'ting")

    # Qolgan og'irlikni hisoblash
    # TODO: aktiv basket og'irligini ayirish
    available_weight_g = int(profile.allowed_kg * 1000)

    # LUXURY ko'rinishi
    can_see_luxury = profile.trust_tier in (TrustTier.TRUSTED.value, TrustTier.VIP.value)

    # Catalog
    product_repo = ProductRepository(session)
    products = await product_repo.get_catalog(
        max_weight_g=available_weight_g,
        include_luxury=can_see_luxury,
        offset=offset,
        limit=limit,
    )

    items = [
        CatalogItem(
            id=p.id,
            short_code=p.short_code,
            spec_title=p.sourcing_spec.title if p.sourcing_spec else "",
            spec_photos=p.sourcing_spec.photos if p.sourcing_spec else [],
            unit_weight_g=p.unit_weight_g,
            color=p.color,
            cargo_price=p.cargo_price_uz_to_tr,
            cargo_currency=p.cargo_currency,
            created_at=p.created_at,
        )
        for p in products
    ]

    return CatalogResponse(
        items=items,
        total=len(items),  # TODO: alohida count query
        available_weight_g=available_weight_g,
    )
