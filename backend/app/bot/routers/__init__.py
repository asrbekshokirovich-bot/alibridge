"""Bot router'lari — har bir rol uchun alohida."""

from app.bot.routers.admin import router as admin_router
from app.bot.routers.carrier import router as carrier_router
from app.bot.routers.china import router as china_router
from app.bot.routers.common import router as common_router
from app.bot.routers.couriers import router as courier_router
from app.bot.routers.orderer import router as orderer_router
from app.bot.routers.warehouse_tr import router as warehouse_tr_router
from app.bot.routers.warehouse_uz import router as warehouse_uz_router

__all__ = [
    "admin_router",
    "carrier_router",
    "china_router",
    "common_router",
    "courier_router",
    "orderer_router",
    "warehouse_tr_router",
    "warehouse_uz_router",
]
