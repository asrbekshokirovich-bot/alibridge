"""Asosiy Dispatcher — barcha router'lar bu yerda ulanadi."""

from __future__ import annotations

from aiogram import Dispatcher

from app.bot.middlewares.auth import AuthMiddleware
from app.bot.middlewares.i18n import I18nMiddleware
from app.bot.middlewares.throttling import ThrottlingMiddleware
from app.bot.routers import (
    admin_router,
    carrier_router,
    china_router,
    common_router,
    courier_router,
    orderer_router,
    warehouse_tr_router,
    warehouse_uz_router,
)
from app.infra.telegram.bot import dp


def setup_dispatcher() -> Dispatcher:
    """Dispatcher'ni router'lar va middleware'lar bilan sozlash."""
    # Middleware'lar (har messagega qo'llaniladi)
    # Tartib muhim: Throttling → I18n → Auth
    dp.message.middleware(ThrottlingMiddleware())
    dp.callback_query.middleware(ThrottlingMiddleware())
    dp.message.middleware(I18nMiddleware())
    dp.callback_query.middleware(I18nMiddleware())
    dp.message.middleware(AuthMiddleware())
    dp.callback_query.middleware(AuthMiddleware())

    # Router'lar (tartib muhim — common eng oxirida)
    dp.include_router(orderer_router)
    dp.include_router(china_router)
    dp.include_router(carrier_router)
    dp.include_router(warehouse_uz_router)
    dp.include_router(warehouse_tr_router)
    dp.include_router(courier_router)
    dp.include_router(admin_router)
    dp.include_router(common_router)  # fallback /start, /help

    return dp
