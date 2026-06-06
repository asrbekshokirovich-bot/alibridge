from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_role
from app.core.enums import (
    CustodyEventType,
    HolderType,
    ProductStatus,
    Role,
)
from app.db.base import get_db
from app.db.models import Order, OrderItem, Product, User, WalkInCustomer
from app.schemas.common import OkResponse
from app.schemas.product import ProductOut
from app.schemas.serializers import product_to_out
from app.schemas.warehouse import (
    ConfirmRequest,
    ScanRequest,
    ScanResponse,
    WalkInRequest,
)
from app.services.custody_service import get_product_by_barcode, transfer_custody

router = APIRouter(prefix="/warehouse-tr", tags=["warehouse_tr"])

ROLE = (Role.WAREHOUSE_TR,)


async def _carrier_for_product(db: AsyncSession, product_id: int) -> User | None:
    return await db.scalar(
        select(User)
        .join(Order, Order.carrier_id == User.id)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(OrderItem.product_id == product_id)
        .limit(1)
    )


# ─── Yo'lovchidan qabul ─────────────────────────────────────────────────────────


@router.post("/scan-receive", response_model=ScanResponse)
async def scan_receive(
    body: ScanRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> ScanResponse:
    product = await get_product_by_barcode(db, body.barcode)
    carrier = await _carrier_for_product(db, product.id)
    return ScanResponse(
        barcode=product.barcode,
        product_name=product.name,
        carrier_name=f"{carrier.first_name} {carrier.last_name}".strip() if carrier else None,
    )


@router.post("/confirm-receive", response_model=OkResponse)
async def confirm_receive(
    body: ConfirmRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> OkResponse:
    for barcode in body.barcodes:
        product = await get_product_by_barcode(db, barcode)
        await transfer_custody(
            db,
            product,
            to_holder_type=HolderType.WAREHOUSE_TR,
            to_holder_id=user.id,
            event_type=CustodyEventType.WAREHOUSE_TR_RECEIVED,
            scanned_by=user.id,
            new_status=ProductStatus.DELIVERED_TR,
        )
    return OkResponse(ok=True)


# ─── Kuryerga topshirish ────────────────────────────────────────────────────────


@router.post("/scan-handover", response_model=ScanResponse)
async def scan_handover(
    body: ScanRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> ScanResponse:
    product = await get_product_by_barcode(db, body.barcode)
    return ScanResponse(barcode=product.barcode, product_name=product.name)


@router.post("/confirm-handover", response_model=OkResponse)
async def confirm_handover(
    body: ConfirmRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> OkResponse:
    for barcode in body.barcodes:
        product = await get_product_by_barcode(db, barcode)
        await transfer_custody(
            db,
            product,
            to_holder_type=HolderType.COURIER_TR,
            to_holder_id=None,
            event_type=CustodyEventType.WAREHOUSE_TR_HANDOVER,
            scanned_by=user.id,
        )
    return OkResponse(ok=True)


# ─── Walk-in mijoz ──────────────────────────────────────────────────────────────


@router.post("/walk-in", response_model=OkResponse)
async def walk_in(
    body: WalkInRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> OkResponse:
    db.add(
        WalkInCustomer(
            name=body.name,
            phone=body.phone,
            note=body.note,
            created_by=user.id,
        )
    )
    await db.flush()
    return OkResponse(ok=True)


# ─── UZ ombori mahsulotlari (read-only, box_weight KO'RINADI) ────────────────────


@router.get("/uz-products", response_model=list[ProductOut])
async def uz_products(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> list[ProductOut]:
    rows = await db.execute(
        select(Product)
        .where(Product.status == ProductStatus.IN_WAREHOUSE_UZ)
        .order_by(Product.created_at.desc())
    )
    # warehouse_tr box_weight_kg ni KO'RA OLADI (firewall yo'q)
    return [product_to_out(p, expose_box_weight=True) for p in rows.scalars().all()]
