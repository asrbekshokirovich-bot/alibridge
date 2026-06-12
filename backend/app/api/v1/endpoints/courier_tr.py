from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import require_role
from app.bot import notify
from app.bot.notify import on_damage_reported
from app.core.enums import (
    CustodyEventType,
    DisputeStatus,
    HolderType,
    OrderStatus,
    ProductStatus,
    Role,
)
from app.core.errors import AppError
from app.db.base import get_db
from app.db.models import Dispute, Order, OrderItem, Product, User
from app.schemas.common import OkResponse
from app.schemas.courier import (
    ConfirmDeliveryRequest,
    DeliveryItem,
    ReportDamagedRequest,
    ScanDeliveryRequest,
)
from app.schemas.warehouse import (
    ConfirmRequest,
    ScanRequest,
    ScanResponse,
    VariantAvailability,
)
from app.services.custody_service import (
    availability_by_type,
    find_source_holder_id,
    get_product_by_barcode,
    is_fully_arrived,
    resolve_variant_id,
    transfer_custody,
)
from app.services.payment_service import recompute_carrier_payment


async def _scan_avail(
    db: AsyncSession, barcode: str, holder_type: HolderType
) -> tuple[Product, list[tuple[int, str, int]], User | None]:
    """Scan yordamchisi: product + manba turdagi mavjudlik + yo'lovchi."""
    product = await db.scalar(
        select(Product)
        .options(selectinload(Product.variants))
        .where(Product.barcode == barcode)
    )
    if product is None:
        raise AppError("BARCODE_NOT_FOUND", "Barkod topilmadi", status_code=400)
    avail = await availability_by_type(db, product=product, holder_type=holder_type)
    if not avail:
        raise AppError(
            "INVALID_PRODUCT_STATE", "Bu yukdan bu bosqichda qolmagan"
        )
    carrier = await _carrier_for_product(db, product.id)
    return product, avail, carrier

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
    # Manba: yo'lovchi (CARRIER) — TR kuryeri yo'lovchidan oladi
    product, avail, carrier = await _scan_avail(db, body.barcode, HolderType.CARRIER)
    return ScanResponse(
        barcode=product.barcode,
        product_name=product.name,
        carrier_name=f"{carrier.first_name} {carrier.last_name}".strip() if carrier else None,
        carrier_number=carrier.carrier_number if carrier else None,
        quantity=sum(a[2] for a in avail),
        available_by_variant=[
            VariantAvailability(variant_id=vid, size_label=sl, available=q)
            for vid, sl, q in avail
        ],
    )


@router.post("/confirm-receive", response_model=OkResponse)
async def confirm_receive(
    body: ConfirmRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> OkResponse:
    affected_carriers: set[int] = set()
    for item in body.items:
        product = await db.scalar(
            select(Product)
            .options(selectinload(Product.variants))
            .where(Product.barcode == item.barcode)
        )
        if product is None:
            raise AppError("BARCODE_NOT_FOUND", f"Barkod topilmadi: {item.barcode}")
        variant_id = await resolve_variant_id(
            db, product=product, variant_id=item.variant_id
        )
        src_id = await find_source_holder_id(
            db, variant_id=variant_id, holder_type=HolderType.CARRIER
        )
        if src_id is None:
            raise AppError(
                "INVALID_PRODUCT_STATE",
                f"Yuk ({item.barcode}) yo'lovchida emas",
                status_code=400,
            )
        await transfer_custody(
            db,
            product,
            variant_id=variant_id,
            quantity=item.quantity,
            from_holder_type=HolderType.CARRIER,
            from_holder_id=src_id,
            to_holder_type=HolderType.COURIER_TR,
            to_holder_id=user.id,
            event_type=CustodyEventType.COURIER_TR_RECEIVED,
            scanned_by=user.id,
        )
        carrier = await _carrier_for_product(db, product.id)
        if carrier:
            affected_carriers.add(carrier.id)

    # Yuk tashilgach to'lov avto-hisoblanadi (invariant)
    for carrier_id in affected_carriers:
        await recompute_carrier_payment(db, carrier_id)
    return OkResponse(ok=True)


# ─── Turkiya omboriga topshirish ────────────────────────────────────────────────


@router.post("/scan-handover-warehouse", response_model=ScanResponse)
async def scan_handover_warehouse(
    body: ScanRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> ScanResponse:
    """Omborga topshirishdan oldin barkodni tekshirish (manba: TR kuryer)."""
    product, avail, carrier = await _scan_avail(db, body.barcode, HolderType.COURIER_TR)
    return ScanResponse(
        barcode=product.barcode,
        product_name=product.name,
        carrier_name=f"{carrier.first_name} {carrier.last_name}".strip() if carrier else None,
        carrier_number=carrier.carrier_number if carrier else None,
        quantity=sum(a[2] for a in avail),
        available_by_variant=[
            VariantAvailability(variant_id=vid, size_label=sl, available=q)
            for vid, sl, q in avail
        ],
    )


@router.post("/confirm-handover-warehouse", response_model=OkResponse)
async def confirm_handover_warehouse(
    body: ConfirmRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> OkResponse:
    """Kuryer yukni Turkiya omboriga topshiradi — custody ombor (WAREHOUSE_TR) ga o'tadi."""
    for item in body.items:
        product = await db.scalar(
            select(Product)
            .options(selectinload(Product.variants))
            .where(Product.barcode == item.barcode)
        )
        if product is None:
            raise AppError("BARCODE_NOT_FOUND", f"Barkod topilmadi: {item.barcode}")
        variant_id = await resolve_variant_id(
            db, product=product, variant_id=item.variant_id
        )
        await transfer_custody(
            db,
            product,
            variant_id=variant_id,
            quantity=item.quantity,
            from_holder_type=HolderType.COURIER_TR,
            from_holder_id=user.id,
            to_holder_type=HolderType.WAREHOUSE_TR,
            to_holder_id=0,  # umumiy Turkiya ombori (aniq xodim emas)
            event_type=CustodyEventType.WAREHOUSE_TR_RECEIVED,
            scanned_by=user.id,
        )
        # Bu mahsulotning hammasi TR omborga yetdimi?
        if await is_fully_arrived(db, product.id):
            carrier = await _carrier_for_product(db, product.id)
            await notify.on_all_arrived(
                db,
                barcode=product.barcode,
                product_name=product.name,
                carrier_id=carrier.id if carrier else None,
            )
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
    # Manba: TR ombor (WAREHOUSE_TR) — kuryer omborldan olib buyurtmachiga yetkazadi
    product, avail, _ = await _scan_avail(db, body.barcode, HolderType.WAREHOUSE_TR)
    return ScanResponse(
        barcode=product.barcode,
        product_name=product.name,
        quantity=sum(a[2] for a in avail),
        available_by_variant=[
            VariantAvailability(variant_id=vid, size_label=sl, available=q)
            for vid, sl, q in avail
        ],
    )


@router.post("/confirm-delivery", response_model=OkResponse)
async def confirm_delivery(
    body: ConfirmDeliveryRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> OkResponse:
    for item in body.items:
        product = await db.scalar(
            select(Product)
            .options(selectinload(Product.variants))
            .where(Product.barcode == item.barcode)
        )
        if product is None:
            raise AppError("BARCODE_NOT_FOUND", f"Barkod topilmadi: {item.barcode}")
        variant_id = await resolve_variant_id(
            db, product=product, variant_id=item.variant_id
        )
        await transfer_custody(
            db,
            product,
            variant_id=variant_id,
            quantity=item.quantity,
            from_holder_type=HolderType.WAREHOUSE_TR,
            from_holder_id=0,
            to_holder_type=HolderType.ORDERER,
            to_holder_id=0,
            event_type=CustodyEventType.DELIVERED,
            scanned_by=user.id,
        )
    return OkResponse(ok=True)
