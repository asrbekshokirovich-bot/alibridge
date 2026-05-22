"""Stale dispute reminder — 48 soatdan ko'p hal qilinmagan dispute'lar."""

from __future__ import annotations

from typing import Any

from app.core.logger import get_logger

log = get_logger(__name__)


async def remind_stale_disputes(ctx: dict[str, Any]) -> int:
    """48 soatdan ortiq hal qilinmagan dispute'lar haqida adminga eslatma."""
    # TODO: implement
    log.debug("dispute_reminder_ran")
    return 0
