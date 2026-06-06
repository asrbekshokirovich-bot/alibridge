from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin,
    auth,
    carrier,
    courier_tr,
    courier_uz,
    labels,
    warehouse_tr,
    warehouse_uz,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(carrier.router)
api_router.include_router(warehouse_uz.router)
api_router.include_router(courier_uz.router)
api_router.include_router(courier_tr.router)
api_router.include_router(warehouse_tr.router)
api_router.include_router(admin.router)
api_router.include_router(labels.router)
