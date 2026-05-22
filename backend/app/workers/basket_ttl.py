"""Basket TTL releaser — 20-minut ushlab turilgan korzina'larni bo'shatish.

DEV_PLAN §8.4 — agar carrier 20 daqiqa harakatsiz tursa,
mahsulot katalogga qaytariladi.
"""

from __future__ import annotations

from typing import Any

from app.core.logger import get_logger
from app.infra.db.session import AsyncSessionLocal
from app.repositories.product_repo import ProductRepository

log = get_logger(__name__)


async def release_expired_baskets(ctx: dict[str, Any]) -> int:
    """Muddati o'tgan basket lock'larni bo'shatish.

    Returns:
        Bo'shatilgan pick'lar soni
    """
    async with AsyncSessionLocal() as session:
        repo = ProductRepository(session)
        released_count = await repo.release_expired_baskets()
        await session.commit()

    if released_count:
        log.info("baskets_released", count=released_count)

    return released_count
