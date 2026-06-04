"""Basket endpoint — savatga qo'shish/o'chirish."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user, require_role
from app.api.deps.db import get_db_session
from app.domain.entities.carrier import CarrierPickEntity
from app.domain.enums import HandoffMode, HandoffStatus, Role, TrDeliveryMode
from app.infra.db.models.user import User
from app.infra.db.models.carrier import CarrierPick
from app.infra.db.models.product import Product
from app.repositories.carrier_repo import CarrierPickRepository, CarrierProfileRepository
from app.repositories.product_repo import ProductRepository

router = APIRouter()

# Savatdagi vazn hisobiga kiradigan statuslar
_ACTIVE_PICK_STATUSES = [
    HandoffStatus.IN_BASKET.value,
    HandoffStatus.AWAITING_HANDOFF.value,
    HandoffStatus.CARRIER_HAS_CUSTODY.value,
    HandoffStatus.IN_FLIGHT.value,
]


async def _assert_weight_within_limit(
    session: AsyncSession, user_id, product: Product
) -> None:
    """Mahsulot qo'shilsa carrier'ning allowed_kg chegarasidan oshmasligini tekshirish."""
    from app.core.exceptions import ValidationError

    profile = await CarrierProfileRepository(session).get_by_user_id(user_id)
    if not profile or not profile.allowed_kg:
        return
    total_allowed_g = int(profile.allowed_kg * 1000)
    used_result = await session.execute(
        select(func.coalesce(func.sum(Product.unit_weight_g), 0))
        .join(CarrierPick, CarrierPick.product_id == Product.id)
        .where(
            CarrierPick.carrier_user_id == user_id,
            CarrierPick.handoff_status.in_(_ACTIVE_PICK_STATUSES),
        )
    )
    used_g = int(used_result.scalar_one() or 0)
    if used_g + (product.unit_weight_g or 0) > total_allowed_g:
        remaining_kg = max(0, (total_allowed_g - used_g) / 1000)
        raise ValidationError(
            message=f"Vazn chegarasi oshib ketadi. Qolgan sig'im: {remaining_kg:.1f} kg"
        )


class BasketItemResponse(BaseModel):
    id: str
    product_id: str
    short_code: str
    spec_title: str
    spec_photo: str | None
    unit_weight_g: int
    locked_cargo_price: str
    locked_currency: str
    basket_lock_until: str | None


class AddToBasketRequest(BaseModel):
    product_id: uuid.UUID


class AddBySpecRequest(BaseModel):
    spec_id: uuid.UUID


@router.get("", response_model=list[BasketItemResponse])
async def get_basket(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[BasketItemResponse]:
    """Hozirgi korzina — mahsulot ma'lumotlari bilan.

    Muddati o'tgan IN_BASKET lock'lar avtomatik tozalanadi:
    mahsulot AT_TASHKENT_WH ga, pick CANCELLED ga o'tkaziladi.
    """
    from datetime import datetime, timezone
    from app.domain.enums import HandoffStatus, ProductStatus

    now = datetime.now(timezone.utc)

    # Muddati o'tgan locklar — tozalash
    expired_stmt = (
        select(CarrierPick)
        .options(selectinload(CarrierPick.product))
        .where(
            CarrierPick.carrier_user_id == user.id,
            CarrierPick.handoff_status == HandoffStatus.IN_BASKET.value,
            CarrierPick.basket_lock_until < now,
        )
    )
    expired_picks = list((await session.execute(expired_stmt)).scalars().all())
    if expired_picks:
        for ep in expired_picks:
            ep.handoff_status = HandoffStatus.CANCELLED.value
            if ep.product and ep.product.status == ProductStatus.IN_BASKET.value:
                ep.product.status = ProductStatus.AT_TASHKENT_WH.value
        await session.commit()

    stmt = (
        select(CarrierPick)
        .options(
            selectinload(CarrierPick.product).selectinload(Product.sourcing_spec),
        )
        .where(
            CarrierPick.carrier_user_id == user.id,
            CarrierPick.handoff_status == HandoffStatus.IN_BASKET.value,
        )
        .order_by(CarrierPick.picked_at.desc())
    )
    result = await session.execute(stmt)
    picks = list(result.scalars().all())

    items = []
    for p in picks:
        product = p.product
        spec = product.sourcing_spec if product else None
        items.append(BasketItemResponse(
            id=str(p.id),
            product_id=str(p.product_id),
            short_code=product.short_code if product else str(p.product_id)[:8],
            spec_title=spec.title if spec else "Noma'lum mahsulot",
            spec_photo=(spec.photos[0] if spec and spec.photos else None),
            unit_weight_g=product.unit_weight_g if product else 0,
            locked_cargo_price=str(p.locked_cargo_price),
            locked_currency=p.locked_currency or "USD",
            basket_lock_until=p.basket_lock_until.isoformat() if p.basket_lock_until else None,
        ))
    return items


@router.post("/add", response_model=CarrierPickEntity, status_code=201)
async def add_to_basket(
    body: AddToBasketRequest,
    user: User = Depends(require_role(Role.CARRIER)),
    session: AsyncSession = Depends(get_db_session),
) -> CarrierPickEntity:
    """Mahsulotni korzinaga qo'shish.

    Atomic operation:
    - SELECT FOR UPDATE
    - INSERT carrier_pick
    - UPDATE product.status
    """
    from app.core.exceptions import ValidationError

    # Vazn cheki (M3) — /add-by-spec dagidek
    product = await session.get(Product, body.product_id)
    if product is None:
        raise ValidationError(message="Mahsulot topilmadi")
    await _assert_weight_within_limit(session, user.id, product)

    repo = ProductRepository(session)
    pick = await repo.lock_for_basket(
        product_id=body.product_id,
        carrier_user_id=user.id,
    )
    return CarrierPickEntity.model_validate(pick)


@router.post("/add-by-spec", response_model=CarrierPickEntity, status_code=201)
async def add_to_basket_by_spec(
    body: AddBySpecRequest,
    user: User = Depends(require_role(Role.CARRIER)),
    session: AsyncSession = Depends(get_db_session),
) -> CarrierPickEntity:
    """Spec_id bo'yicha birinchi mavjud mahsulotni savatga qo'shish.

    Vazn cheki: carrier profilidagi allowed_kg oshmasligi kerak.
    """
    from app.domain.enums import ProductStatus
    from app.core.exceptions import ValidationError

    # 1. Mahsulotni topish
    result = await session.execute(
        select(Product)
        .where(
            Product.sourcing_spec_id == body.spec_id,
            Product.status == ProductStatus.AT_TASHKENT_WH.value,
        )
        .order_by(Product.created_at)
        .limit(1)
    )
    product = result.scalar_one_or_none()
    if product is None:
        raise ValidationError(message="Bu spec bo'yicha mavjud mahsulot yo'q")

    # 2. Vazn cheki (umumiy helper)
    await _assert_weight_within_limit(session, user.id, product)

    repo = ProductRepository(session)
    pick = await repo.lock_for_basket(
        product_id=product.id,
        carrier_user_id=user.id,
    )
    return CarrierPickEntity.model_validate(pick)


class CheckoutRequest(BaseModel):
    """Savatni tasdiqlashda yetkazib berish/topshirish usullari.

    UZ (Toshkentda mahsulotni qanday olish):
      airport   — aeroportdan o'zi oladi
      warehouse — UZ ombordan o'zi oladi
      address   — o'z manziliga yetkaziladi (delivery_address_uz majburiy)
    TR (Turkiyada yukni qanday topshirish):
      airport — aeroportda topshiriladi
      address — o'z manzilidan kuryer oladi (carrier_address_tr majburiy)
      hotel   — uy/mehmonxonadan olib ketiladi (carrier_address_tr majburiy)
    """

    uz_pickup: Literal["airport", "warehouse", "address"] = "airport"
    delivery_address_uz: str | None = None
    tr_handoff: Literal["airport", "address", "hotel"] = "airport"
    carrier_address_tr: str | None = None


_UZ_PICKUP_MAP = {
    "airport": HandoffMode.AIRPORT_BACKSIDE.value,
    "warehouse": HandoffMode.WH_PICKUP.value,
    "address": HandoffMode.FREE_TASHKENT.value,
}
_TR_HANDOFF_MAP = {
    "airport": TrDeliveryMode.TR_AIRPORT_PICKUP.value,
    "address": TrDeliveryMode.TR_COURIER_FROM_CARRIER.value,
    "hotel": TrDeliveryMode.TR_HOME_HOTEL_PICKUP.value,
}


@router.post("/checkout", status_code=200)
async def checkout_basket(
    body: CheckoutRequest,
    user: User = Depends(require_role(Role.CARRIER)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Savatni tasdiqlash — barcha IN_BASKET pick'larni AWAITING_HANDOFF ga o'tkazish.

    Carrier omborga kelayotganligini tasdiqlaydi. Warehouse xodimi bu ro'yxatni ko'radi.
    Yetkazib berish (UZ) va topshirish (TR) usullari pick'larga yoziladi.
    """
    from app.core.exceptions import ValidationError

    # Manzil validatsiyasi — tanlovga qarab
    uz_addr = (body.delivery_address_uz or "").strip()
    if body.uz_pickup == "address" and not uz_addr:
        raise ValidationError(message="O'z manzilingizga yetkazish uchun Toshkentdagi manzilni kiriting")

    tr_addr = (body.carrier_address_tr or "").strip()
    if body.tr_handoff in ("address", "hotel") and not tr_addr:
        raise ValidationError(message="Turkiyadagi manzilni kiriting")

    stmt = select(CarrierPick).where(
        CarrierPick.carrier_user_id == user.id,
        CarrierPick.handoff_status == HandoffStatus.IN_BASKET.value,
    )
    picks = list((await session.execute(stmt)).scalars().all())

    if not picks:
        raise ValidationError(message="Savatda mahsulot yo'q")

    for pick in picks:
        pick.handoff_status = HandoffStatus.AWAITING_HANDOFF.value
        pick.basket_lock_until = None  # TTL lock olib tashlash
        pick.handoff_mode = _UZ_PICKUP_MAP[body.uz_pickup]
        pick.delivery_address_uz = uz_addr or None
        pick.tr_delivery_mode = _TR_HANDOFF_MAP[body.tr_handoff]
        pick.carrier_address_tr = tr_addr or None
        # WH tasdig'ini kutadi
        pick.wh_approved_at = None
        pick.wh_rejected_at = None
        pick.rejection_reason = None

    await session.commit()

    # WH UZ xodimlarini xabardor qilish (best-effort — polling'ni to'ldiradi)
    from app.infra.telegram.notify import notify_role

    name = user.full_name or user.telegram_username or "Yo'lovchi"
    await notify_role(
        session,
        Role.WAREHOUSE_UZ,
        f"🚶 <b>{name}</b> savatni tasdiqladi — {len(picks)} ta mahsulot.\n"
        f"«Kutayotgan yo'lovchilar» bo'limida tasdiqlang.",
    )

    return {"confirmed": len(picks)}


@router.delete("/{pick_id}", status_code=204)
async def remove_from_basket(
    pick_id: uuid.UUID,
    user: User = Depends(require_role(Role.CARRIER)),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Korzinadan olib tashlash."""
    repo = CarrierPickRepository(session)
    pick = await repo.get_by_id(pick_id)

    if pick is None or pick.carrier_user_id != user.id:
        from app.core.exceptions import NotFoundError

        raise NotFoundError(message="Korzinada bunday element yo'q")

    # Mahsulotni katalogga qaytarish
    from app.domain.enums import ProductStatus

    if pick.handoff_status != HandoffStatus.IN_BASKET.value:
        from app.core.exceptions import ValidationError

        raise ValidationError(message="Faqat basket'dagi elementlar o'chiriladi")

    product_repo = ProductRepository(session)
    product = await product_repo.get_by_id(pick.product_id)
    if product:
        product.status = ProductStatus.AT_TASHKENT_WH.value

    await session.delete(pick)
    await session.flush()
