"""Redis async client.

Bu modul Redis ulanishini boshqaradi:
- Singleton client (har process'da 1 ta)
- Connection pool
- Pickle yoki JSON serializatsiya

Ishlatish:
    redis = get_redis()
    await redis.set("key", "value", ex=60)
    value = await redis.get("key")
"""

from __future__ import annotations

import json
from typing import Any

from redis.asyncio import Redis, from_url

from app.core.config import settings
from app.core.logger import get_logger

log = get_logger(__name__)

# Singleton client — `init_redis()` chaqirilgandan keyin to'ldiriladi
_redis: Redis | None = None


async def init_redis() -> Redis:
    """Redis ulanishini ochish (app startup'da chaqiriladi)."""
    global _redis
    if _redis is not None:
        return _redis

    _redis = from_url(
        settings.cache_url,
        encoding="utf-8",
        decode_responses=True,
        socket_connect_timeout=5,
        socket_keepalive=True,
        health_check_interval=30,
    )

    # Test ulanish
    pong = await _redis.ping()
    if not pong:
        raise RuntimeError("Redis ping muvaffaqiyatsiz")

    log.info("redis_connected", url=settings.cache_url)
    return _redis


def get_redis() -> Redis:
    """Aktiv Redis client'ni qaytaradi.

    Eslatma: avval `init_redis()` chaqirilgan bo'lishi shart.
    """
    if _redis is None:
        raise RuntimeError("Redis hali init_redis() bilan ishga tushmagan")
    return _redis


async def close_redis() -> None:
    """Redis ulanishini yopish (app shutdown'da)."""
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None
        log.info("redis_closed")


# ============================================
# Helper funksiyalar — JSON serializatsiya
# ============================================
async def set_json(key: str, value: Any, ttl: int | None = None) -> None:
    """Object'ni JSON sifatida saqlash."""
    redis = get_redis()
    serialized = json.dumps(value, default=str)
    if ttl:
        await redis.set(key, serialized, ex=ttl)
    else:
        await redis.set(key, serialized)


async def get_json(key: str) -> Any | None:
    """JSON-saqlangan object'ni o'qish."""
    redis = get_redis()
    value = await redis.get(key)
    if value is None:
        return None
    return json.loads(value)
