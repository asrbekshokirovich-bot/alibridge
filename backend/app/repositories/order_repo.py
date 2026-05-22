"""
Order repository — buyurtmalar bilan ishlash.
Role: orderer, admin, warehouse_uz (intake).
"""
from __future__ import annotations

import uuid
from typing import List, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infra.db.models.order import Order, OrderLine, SourcingSpec
from app.infra.db.models.product import Product
from app.domain.enums import OrderStatus, OrderSource


class OrderRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        *,
        orderer_id: Optional[str],
        walk_in_customer_id: Optional[str],
        source: OrderSource,
        destination_city: str,
        notes: Optional[str] = None,
    ) -> Order:
        """Yangi buyurtma yaratish. XOR: orderer_id yoki walk_in_customer_id."""
        assert bool(orderer_id) != bool(walk_in_customer_id), (
            "Exactly one of orderer_id or walk_in_customer_id must be set"
        )
        order = Order(
            id=str(uuid.uuid4()),
            orderer_id=orderer_id,
            walk_in_customer_id=walk_in_customer_id,
            source=source,
            destination_city=destination_city,
            notes=notes,
            status=OrderStatus.DRAFT,
        )
        self._session.add(order)
        await self._session.flush()
        return order

    async def add_line(
        self,
        *,
        order_id: str,
        spec_id: str,
        quantity: int,
        unit_weight_g: int,
    ) -> OrderLine:
        """Buyurtmaga qator qo'shish."""
        line = OrderLine(
            id=str(uuid.uuid4()),
            order_id=order_id,
            spec_id=spec_id,
            quantity=quantity,
            unit_weight_g=unit_weight_g,
        )
        self._session.add(line)
        await self._session.flush()
        return line

    async def get_by_id(self, order_id: str) -> Optional[Order]:
        """ID bo'yicha buyurtma + qatorlar."""
        stmt = (
            select(Order)
            .where(Order.id == order_id)
            .options(selectinload(Order.lines))
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_orderer(self, orderer_id: str) -> List[Order]:
        """Foydalanuvchining barcha buyurtmalari."""
        stmt = (
            select(Order)
            .where(Order.orderer_id == orderer_id)
            .order_by(Order.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def update_status(self, order_id: str, status: OrderStatus) -> None:
        """Buyurtma statusini yangilash."""
        stmt = select(Order).where(Order.id == order_id)
        result = await self._session.execute(stmt)
        order = result.scalar_one_or_none()
        if order:
            order.status = status
            await self._session.flush()

    async def get_summary(self, orderer_id: str) -> dict:
        """Buyurtma statistikasi."""
        base = select(func.count(Order.id)).where(Order.orderer_id == orderer_id)

        total = (await self._session.execute(base)).scalar_one()
        in_transit = (
            await self._session.execute(
                base.where(Order.status == OrderStatus.IN_TRANSIT)
            )
        ).scalar_one()
        delivered = (
            await self._session.execute(
                base.where(Order.status == OrderStatus.DELIVERED)
            )
        ).scalar_one()

        return {"total": total, "in_transit": in_transit, "delivered": delivered}


class SourcingSpecRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        *,
        title: str,
        photos: List[str],
        unit_weight_g: int,
        color: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> SourcingSpec:
        spec = SourcingSpec(
            id=str(uuid.uuid4()),
            title=title,
            photos=photos,
            unit_weight_g=unit_weight_g,
            color=color,
            notes=notes,
        )
        self._session.add(spec)
        await self._session.flush()
        return spec

    async def search(self, query: str, limit: int = 20) -> List[SourcingSpec]:
        """Title bo'yicha qidirish (GIN index ishlatiladi)."""
        stmt = (
            select(SourcingSpec)
            .where(SourcingSpec.title.ilike(f"%{query}%"))
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
