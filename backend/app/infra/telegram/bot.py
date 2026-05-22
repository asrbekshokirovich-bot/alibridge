"""aiogram Bot va Dispatcher (singleton).

Bot tokenni .env'dan oladi. Dispatcher router'larni keyin bog'laydi.
"""

from __future__ import annotations

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.redis import RedisStorage

from app.core.config import settings


# Bot instance — har process'da bitta
bot = Bot(
    token=settings.bot_token,
    default=DefaultBotProperties(parse_mode=ParseMode.HTML),
)


# Storage: Redis FSM uchun (multi-step suhbatlar)
# init_redis() chaqirilgandan keyin to'liq ishlaydi
def _build_dispatcher() -> Dispatcher:
    """Dispatcher yaratish + Redis storage ulash."""
    storage = RedisStorage.from_url(settings.cache_url)
    return Dispatcher(storage=storage)


dp = _build_dispatcher()
