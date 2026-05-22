"""
Courier repository — kuryerlar bilan ishlash.
Role: courier_uz, courier_tr, warehouse_tr (assign).
"""
from __future__ import annotations

import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.db.models.product import Product
from app.domain.enums import ProductStatus, HolderType


class CourierRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_dispatch_queue(self, courier_id: str) -> List[Product]:
        """
        Kuryerga berilgan, yetkazish kutayotgan mahsulotlar.
        """
        stmt = (
            select(Product)
            .where(
                Product.custody_holder_type == HolderType.COURIER_TR,
                Product.custody_holder_id == courier_id,
                Product.status != ProductStatus.DELIVERED,
            )
            .order_by(Product.updated_at.asc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def mark_delivered(self, product_id: str, courier_id: str) -> Product:
        """Mahsulotni yetkazilgan deb belgilash."""
        stmt = select(Product).where(
            Product.id == product_id,
            Product.custody_holder_id == courier_id,
        )
        result = await self._session.execute(stmt)
        product = result.scalar_one()
        product.status = ProductStatus.DELIVERED
        await self._session.flush()
        return product

    async def get_stats(self, courier_id: str) -> dict:
        """Kuryer statistikasi."""
        from sqlalchemy import func

        base = select(func.count(Product.id)).where(
            Product.custody_holder_id == courier_id
        )
        pending = (
            await self._session.execute(
                base.where(Product.custody_holder_type == HolderType.COURIER_TR)
                .where(Product.status != ProductStatus.DELIVERED)
            )
        ).scalar_one()
        delivered_today = (
            await self._session.execute(
                base.where(Product.status == ProductStatus.DELIVERED)
            )
        ).scalar_one()

        return {
            "pending_pickup": pending,
            "in_delivery": pending,
            "delivered_today": delivered_today,
        }


class CourierUzRepository:
    """O'zbekiston ichki yetkazib berish kuryerlari."""
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_dispatch_queue(self, courier_id: str) -> List[Product]:
        stmt = (
            select(Product)
            .where(
                Product.custody_holder_type == HolderType.COURIER_UZ,
                Product.custody_holder_id == courier_id,
                Product.status != ProductStatus.DELIVERED,
            )
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
