"""Product repository.

MUHIM: lock_for_basket() metodi SELECT FOR UPDATE bilan ishlaydi
— bu Invariant 1 (single-holder custody) himoya qiladi.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, select
from sqlalchemy.orm import selectinload

from app.core.exceptions import BasketLockedError, NotFoundError
from app.domain.enums import HandoffStatus, HolderType, ProductStatus
from app.infra.db.models.carrier import CarrierPick
from app.infra.db.models.product import Product
from app.repositories.base import BaseRepository


class ProductRepository(BaseRepository[Product]):
    model = Product

    async def get_by_short_code(self, short_code: str) -> Product | None:
        """Short code bo'yicha topish (manual entry uchun)."""
        result = await self.session.execute(
            select(Product).where(Product.short_code == short_code.upper())
        )
        return result.scalar_one_or_none()

    async def get_catalog(
        self,
        *,
        max_weight_g: int,
        include_luxury: bool = False,
        offset: int = 0,
        limit: int = 20,
    ) -> list[Product]:
        """Katalog ko'rinishi — mavjud, og'irlik chegarasiga sig'adigan.

        Faqat:
        - status = at_tashkent_wh
        - label_attached_at IS NOT NULL
        - basket'da yo'q (yoki TTL o'tgan)
        - unit_weight_g ≤ max_weight_g
        """
        query = (
            select(Product)
            .options(selectinload(Product.sourcing_spec))
            .where(Product.status == ProductStatus.AT_TASHKENT_WH.value)
            .where(Product.label_attached_at.isnot(None))
            .where(Product.unit_weight_g <= max_weight_g)
            .order_by(Product.created_at)
            .offset(offset)
            .limit(limit)
        )

        # LUXURY filter (NEW carriers ko'rmaydi)
        if not include_luxury:
            from app.infra.db.models.order import SourcingSpec

            query = query.join(SourcingSpec).where(
                SourcingSpec.value_tier != "luxury"
            )

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def lock_for_basket(
        self,
        *,
        product_id: uuid.UUID,
        carrier_user_id: uuid.UUID,
        ttl_minutes: int = 20,
    ) -> CarrierPick:
        """Mahsulotni carrier korzinasiga qo'shish (atomic).

        Invariant 1 himoyasi:
        - SELECT FOR UPDATE → boshqa tx bloklanadi
        - UNIQUE(product_id) → ikkinchi insert xato beradi

        Raises:
            BasketLockedError: boshqa carrier'da
            NotFoundError: mahsulot mavjud emas
        """
        # 1. Mahsulotni row-lock bilan olish
        result = await self.session.execute(
            select(Product)
            .where(Product.id == product_id)
            .with_for_update(nowait=False)
        )
        product = result.scalar_one_or_none()

        if product is None:
            raise NotFoundError(message="Mahsulot topilmadi")

        if product.status != ProductStatus.AT_TASHKENT_WH.value:
            raise BasketLockedError(message="Mahsulot katalogda yo'q")

        # 2. Carrier_pick yaratish (UNIQUE constraint himoya)
        from app.infra.db.models.carrier import CarrierPick

        pick = CarrierPick(
            carrier_user_id=carrier_user_id,
            product_id=product_id,
            locked_cargo_price=product.cargo_price_uz_to_tr,
            locked_currency=product.cargo_currency,
            handoff_status=HandoffStatus.IN_BASKET.value,
            basket_lock_until=datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes),
        )
        self.session.add(pick)

        # 3. Product status yangilash
        product.status = ProductStatus.IN_BASKET.value

        await self.session.flush()
        return pick

    async def release_expired_baskets(self) -> int:
        """20-minut TTL o'tgan basket'larni bo'shatish.

        Background worker chaqiradi (basket_ttl_releaser).
        """
        now = datetime.now(timezone.utc)
        result = await self.session.execute(
            select(CarrierPick).where(
                and_(
                    CarrierPick.handoff_status == HandoffStatus.IN_BASKET.value,
                    CarrierPick.basket_lock_until < now,
                )
            )
        )
        picks = list(result.scalars().all())

        for pick in picks:
            # Mahsulotni qaytarib qo'yish
            product = await self.get_by_id(pick.product_id)
            if product and product.status == ProductStatus.IN_BASKET.value:
                product.status = ProductStatus.AT_TASHKENT_WH.value

            # Pick'ni o'chirish
            await self.session.delete(pick)

        await self.session.flush()
        return len(picks)
