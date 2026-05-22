"""Basket endpoint — savatga qo'shish/o'chirish."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.api.deps.db import get_db_session
from app.domain.entities.carrier import CarrierPickEntity
from app.infra.db.models.user import User
from app.repositories.carrier_repo import CarrierPickRepository
from app.repositories.product_repo import ProductRepository

router = APIRouter()


class AddToBasketRequest(BaseModel):
    product_id: uuid.UUID


@router.get("", response_model=list[CarrierPickEntity])
async def get_basket(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[CarrierPickEntity]:
    """Hozirgi korzina."""
    repo = CarrierPickRepository(session)
    picks = await repo.get_basket(user.id)
    return [CarrierPickEntity.model_validate(p) for p in picks]


@router.post("/add", response_model=CarrierPickEntity, status_code=201)
async def add_to_basket(
    body: AddToBasketRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> CarrierPickEntity:
    """Mahsulotni korzinaga qo'shish.

    Atomic operation:
    - SELECT FOR UPDATE
    - INSERT carrier_pick
    - UPDATE product.status
    """
    repo = ProductRepository(session)
    pick = await repo.lock_for_basket(
        product_id=body.product_id,
        carrier_user_id=user.id,
    )
    return CarrierPickEntity.model_validate(pick)


@router.delete("/{pick_id}", status_code=204)
async def remove_from_basket(
    pick_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Korzinadan olib tashlash."""
    repo = CarrierPickRepository(session)
    pick = await repo.get_by_id(pick_id)

    if pick is None or pick.carrier_user_id != user.id:
        from app.core.exceptions import NotFoundError

        raise NotFoundError(message="Korzinada bunday element yo'q")

    # Mahsulotni katalogga qaytarish
    from app.domain.enums import HandoffStatus, ProductStatus

    if pick.handoff_status != HandoffStatus.IN_BASKET.value:
        from app.core.exceptions import ValidationError

        raise ValidationError(message="Faqat basket'dagi elementlar o'chiriladi")

    product_repo = ProductRepository(session)
    product = await product_repo.get_by_id(pick.product_id)
    if product:
        product.status = ProductStatus.AT_TASHKENT_WH.value

    await session.delete(pick)
    await session.flush()
