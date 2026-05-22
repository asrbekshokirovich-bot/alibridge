"""FX kurslar yangilash worker."""

from __future__ import annotations

from typing import Any

from app.core.logger import get_logger
from app.infra.fx import get_fx_service

log = get_logger(__name__)


async def refresh_fx_rates(ctx: dict[str, Any]) -> dict:
    """FX kurslarni yangilash + cache."""
    fx = get_fx_service()
    rates = await fx.get_rates()  # bu chaqiruv cache'ni yangilaydi
    log.info("fx_refreshed", rates={k: str(v) for k, v in rates.items()})
    return {k: str(v) for k, v in rates.items()}
