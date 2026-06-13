from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import require_role
from app.bot import notify
from app.core.enums import (
    CustodyEventType,
    HolderType,
    ProductStatus,
    Role,
)
from app.core.errors import AppError
from app.db.base import get_db
from app.db.models import Order, OrderItem, Product, User, WalkInCustomer
from app.schemas.common import OkResponse
from app.schemas.product import ProductOut
from app.schemas.serializers import product_to_out
from app.schemas.warehouse import (
    ConfirmRequest,
    ScanRequest,
    ScanResponse,
    VariantAvailability,
    WalkInRequest,
)
from app.services.custody_service import (
    availability_by_type,
    find_source_holder_id,
    is_fully_arrived,
    resolve_variant_id,
    transfer_custody,
)

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
    product = await db.scalar(
        select(Product)
        .options(selectinload(Product.variants))
        .where(Product.barcode == body.barcode)
    )
    if product is None:
        raise AppError("BARCODE_NOT_FOUND", "Barkod topilmadi", status_code=400)
    carrier = await _carrier_for_product(db, product.id)
    # Yo'lovchi(lar)da (CARRIER) shu yukdan nechta bor — TR ombor qabul qiladi
    avail = await availability_by_type(db, product=product, holder_type=HolderType.CARRIER)
    if not avail:
        raise AppError(
            "INVALID_PRODUCT_STATE",
            "Bu yukdan yo'lovchida qolmagan yoki allaqachon qabul qilingan",
        )
    return ScanResponse(
        barcode=product.barcode,
        product_name=product.name,
        carrier_name=f"{carrier.first_name} {carrier.last_name}".strip() if carrier else None,
        quantity=sum(a[2] for a in avail),
        available_by_variant=[
            VariantAvailability(variant_id=vid, size_label=sl, available=q) for vid, sl, q in avail
        ],
    )


@router.post("/confirm-receive", response_model=OkResponse)
async def confirm_receive(
    body: ConfirmRequest,
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
        variant_id = await resolve_variant_id(db, product=product, variant_id=item.variant_id)
        # Manba: yuk qaysi yo'lovchida turibdi (scan'da noma'lum, holdingsdan topamiz)
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
            to_holder_type=HolderType.WAREHOUSE_TR,
            to_holder_id=0,
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


# ─── Kuryerga topshirish ────────────────────────────────────────────────────────


@router.post("/scan-handover", response_model=ScanResponse)
async def scan_handover(
    body: ScanRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> ScanResponse:
    product = await db.scalar(
        select(Product)
        .options(selectinload(Product.variants))
        .where(Product.barcode == body.barcode)
    )
    if product is None:
        raise AppError("BARCODE_NOT_FOUND", "Barkod topilmadi", status_code=400)
    avail = await availability_by_type(db, product=product, holder_type=HolderType.WAREHOUSE_TR)
    if not avail:
        raise AppError("INVALID_PRODUCT_STATE", "Bu yukdan omborda qolmagan")
    return ScanResponse(
        barcode=product.barcode,
        product_name=product.name,
        quantity=sum(a[2] for a in avail),
        available_by_variant=[
            VariantAvailability(variant_id=vid, size_label=sl, available=q) for vid, sl, q in avail
        ],
    )


@router.post("/confirm-handover", response_model=OkResponse)
async def confirm_handover(
    body: ConfirmRequest,
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
        variant_id = await resolve_variant_id(db, product=product, variant_id=item.variant_id)
        await transfer_custody(
            db,
            product,
            variant_id=variant_id,
            quantity=item.quantity,
            from_holder_type=HolderType.WAREHOUSE_TR,
            from_holder_id=0,
            to_holder_type=HolderType.COURIER_TR,
            to_holder_id=0,
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
        .options(selectinload(Product.variants))
        .where(Product.status == ProductStatus.IN_WAREHOUSE_UZ)
        .order_by(Product.created_at.desc())
    )
    # warehouse_tr box_weight_kg ni KO'RA OLADI (firewall yo'q)
    return [product_to_out(p, expose_box_weight=True) for p in rows.scalars().all()]
