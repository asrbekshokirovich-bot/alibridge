"""API v1 router — barcha endpoint'larni birlashtirish."""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin,
    auth,
    basket,
    carrier,
    catalog,
    china,
    courier_uz,
    orders,
    payouts,
    profile,
    scan,
    telegram_webhook,
    uploads,
    warehouse_tr,
    warehouse_uz,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(carrier.router, prefix="/carrier", tags=["carrier"])
api_router.include_router(china.router, prefix="/china", tags=["china"])
api_router.include_router(profile.router, prefix="/profile", tags=["profile"])
api_router.include_router(catalog.router, prefix="/catalog", tags=["catalog"])
api_router.include_router(basket.router, prefix="/basket", tags=["basket"])
api_router.include_router(orders.router, prefix="/orders", tags=["orders"])
api_router.include_router(scan.router, prefix="/scan", tags=["scan"])
api_router.include_router(payouts.router, prefix="/payouts", tags=["payouts"])
api_router.include_router(uploads.router, prefix="/uploads", tags=["uploads"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(warehouse_uz.router, prefix="/warehouse/uz", tags=["warehouse-uz"])
api_router.include_router(warehouse_tr.router, prefix="/warehouse/tr", tags=["warehouse-tr"])
api_router.include_router(courier_uz.router, prefix="/courier", tags=["courier-uz"])
api_router.include_router(
    telegram_webhook.router,
    prefix="/telegram",
    tags=["telegram"],
    include_in_schema=False,  # webhook bo'lgani uchun docs'da yashirin
)
