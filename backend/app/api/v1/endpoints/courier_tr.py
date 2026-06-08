from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_role
from app.bot.notify import on_damage_reported
from app.core.enums import (
    CustodyEventType,
    DisputeStatus,
    HolderType,
    OrderStatus,
    ProductStatus,
    Role,
)
from app.db.base import get_db
from app.db.models import Dispute, Order, OrderItem, User
from app.schemas.common import OkResponse
from app.schemas.courier import (
    ConfirmDeliveryRequest,
    DeliveryItem,
    ReportDamagedRequest,
    ScanDeliveryRequest,
)
from app.schemas.warehouse import ConfirmRequest, ScanRequest, ScanResponse
from app.services.custody_service import get_product_by_barcode, transfer_custody
from app.services.payment_service import recompute_carrier_payment

router = APIRouter(prefix="/courier-tr", tags=["courier_tr"])

ROLE = (Role.COURIER_TR,)


async def _carrier_for_product(db: AsyncSession, product_id: int) -> User | None:
    return await db.scalar(
        select(User)
        .join(Order, Order.carrier_id == User.id)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(OrderItem.product_id == product_id)
        .limit(1)
    )


# ─── O'zbekistondan kelgan yuklarni qabul ───────────────────────────────────────


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
        carrier_number=carrier.carrier_number if carrier else None,
    )


@router.post("/confirm-receive", response_model=OkResponse)
async def confirm_receive(
    body: ConfirmRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> OkResponse:
    affected_carriers: set[int] = set()
    for barcode in body.barcodes:
        product = await get_product_by_barcode(db, barcode)
        await transfer_custody(
            db,
            product,
            to_holder_type=HolderType.COURIER_TR,
            to_holder_id=user.id,
            event_type=CustodyEventType.COURIER_TR_RECEIVED,
            scanned_by=user.id,
            new_status=ProductStatus.DELIVERED_TR,
        )
        carrier = await _carrier_for_product(db, product.id)
        if carrier:
            affected_carriers.add(carrier.id)

    # Yuk tashilgach to'lov avto-hisoblanadi (invariant)
    for carrier_id in affected_carriers:
        await recompute_carrier_payment(db, carrier_id)
    return OkResponse(ok=True)


# ─── Shikastlangan yuk ──────────────────────────────────────────────────────────


@router.post("/report-damaged", response_model=OkResponse)
async def report_damaged(
    body: ReportDamagedRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> OkResponse:
    product = await get_product_by_barcode(db, body.barcode)
    carrier = await _carrier_for_product(db, product.id)

    db.add(
        Dispute(
            product_id=product.id,
            carrier_id=carrier.id if carrier else None,
            reported_by=user.id,
            barcode=body.barcode,
            note=body.note,
            status=DisputeStatus.OPEN,
        )
    )
    product.status = ProductStatus.DAMAGED
    await db.flush()
    await on_damage_reported(
        db,
        barcode=body.barcode,
        carrier_number=body.carrier_number or (carrier.carrier_number if carrier else None),
        note=body.note,
    )
    return OkResponse(ok=True)


# ─── Yetkazish (buyurtmachiga) ──────────────────────────────────────────────────


@router.get("/deliveries", response_model=list[DeliveryItem])
async def deliveries(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> list[DeliveryItem]:
    """Yetkazishga tayyor buyurtmalar (delivered_tr — TR ga yetib kelgan)."""
    rows = await db.execute(
        select(Order, User, func.count(OrderItem.id))
        .join(User, User.id == Order.carrier_id)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(Order.status == OrderStatus.DELIVERED_TR)
        .group_by(Order.id, User.id)
    )
    result: list[DeliveryItem] = []
    for order, carrier, count in rows.all():
        result.append(
            DeliveryItem(
                id=order.id,
                address=order.delivery_address_tr,
                recipient_name=f"{carrier.first_name} {carrier.last_name}".strip(),
                products_count=count,
            )
        )
    return result


@router.post("/scan-delivery", response_model=ScanResponse)
async def scan_delivery(
    body: ScanDeliveryRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> ScanResponse:
    product = await get_product_by_barcode(db, body.barcode)
    return ScanResponse(barcode=product.barcode, product_name=product.name)


@router.post("/confirm-delivery", response_model=OkResponse)
async def confirm_delivery(
    body: ConfirmDeliveryRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> OkResponse:
    for barcode in body.barcodes:
        product = await get_product_by_barcode(db, barcode)
        await transfer_custody(
            db,
            product,
            to_holder_type=HolderType.ORDERER,
            to_holder_id=None,
            event_type=CustodyEventType.DELIVERED,
            scanned_by=user.id,
        )
    return OkResponse(ok=True)
