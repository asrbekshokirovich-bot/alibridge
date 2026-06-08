from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_role
from app.bot.notify import on_order_confirmed
from app.core.enums import (
    CustodyEventType,
    HolderType,
    OrderStatus,
    ProductStatus,
    ProductType,
    Role,
)
from app.core.errors import AppError
from app.db.base import get_db
from app.db.models import Order, OrderItem, Product, User
from app.schemas.common import OkResponse
from app.schemas.product import ProductOut
from app.schemas.serializers import product_to_out
from app.schemas.warehouse import (
    ConfirmOrderItemRequest,
    ConfirmOrderItemResponse,
    ConfirmRequest,
    ReceiveGoodsRequest,
    ReceiveGoodsResponse,
    ScanRequest,
    ScanResponse,
    UpdateProductRequest,
    WarehouseOrderItemOut,
    WarehouseOrderOut,
    WarehouseUzStats,
)
from app.services.barcode_service import (
    apply_product_fields,
    build_print_url,
    create_received_product,
)
from app.services.custody_service import get_product_by_barcode, transfer_custody
from app.services.order_service import (
    confirm_order_item,
    list_pending_orders_for_warehouse,
)

router = APIRouter(prefix="/warehouse-uz", tags=["warehouse_uz"])

WH_UZ = (Role.WAREHOUSE_UZ,)


@router.get("/stats", response_model=WarehouseUzStats)
async def stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*WH_UZ)),
) -> WarehouseUzStats:
    # pending_receive: kg bo'yicha (boxed/textile), tortilmagan order itemlar (actual_quantity null)
    pending_receive = await db.scalar(
        select(func.count())
        .select_from(OrderItem)
        .join(Product, Product.id == OrderItem.product_id)
        .where(
            Product.type.in_([ProductType.BOXED, ProductType.TEXTILE, ProductType.WEIGHT]),
            OrderItem.actual_quantity.is_(None),
        )
    )
    in_warehouse = await db.scalar(
        select(func.count())
        .select_from(Product)
        .where(Product.status == ProductStatus.IN_WAREHOUSE_UZ)
    )
    pending_handover = await db.scalar(
        select(func.count()).select_from(Product).where(Product.status == ProductStatus.CONFIRMED)
    )
    pending_orders = await db.scalar(
        select(func.count()).select_from(Order).where(Order.status == OrderStatus.PENDING_ADMIN)
    )
    return WarehouseUzStats(
        pending_receive=pending_receive or 0,
        in_warehouse=in_warehouse or 0,
        pending_handover=pending_handover or 0,
        pending_orders=pending_orders or 0,
    )


@router.post("/receive", response_model=ReceiveGoodsResponse)
async def receive(
    body: ReceiveGoodsRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*WH_UZ)),
) -> ReceiveGoodsResponse:
    """1-qadam: faqat nom bilan mahsulot + barkod yaratadi (soni=0).
    Qolgan ma'lumotlar PATCH /products/{id} orqali to'ldiriladi."""
    product = await create_received_product(
        db,
        name=body.name,
        category=body.category,
        created_by=user.id,
    )
    # Qabul qilindi — custody warehouse_uz da
    await transfer_custody(
        db,
        product,
        to_holder_type=HolderType.WAREHOUSE_UZ,
        to_holder_id=user.id,
        event_type=CustodyEventType.RECEIVED,
        scanned_by=user.id,
    )
    return ReceiveGoodsResponse(
        id=product.id,
        barcode=product.barcode,
        name=product.name,
        received_date=product.received_date.isoformat(),
        print_url=build_print_url(product.barcode),
        quantity=product.quantity,
    )


@router.patch("/products/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: int,
    body: UpdateProductRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*WH_UZ)),
) -> ProductOut:
    """2-qadam (to'ldirish) yoki Tahrirlash: tur/miqdor/vazn/narx ni yangilaydi.
    Faqat omborda turgan (in_warehouse_uz) mahsulotni o'zgartirish mumkin."""
    product = await db.get(Product, product_id)
    if product is None:
        raise AppError("PRODUCT_NOT_FOUND", "Mahsulot topilmadi", status_code=404)
    if product.status != ProductStatus.IN_WAREHOUSE_UZ:
        raise AppError(
            "PRODUCT_LOCKED",
            "Bu mahsulot allaqachon jarayonga o'tgan, o'zgartirib bo'lmaydi",
        )
    apply_product_fields(
        product,
        ptype=body.type,
        quantity=body.quantity,
        weight_kg=body.weight_kg,
        unit_weight_kg=body.unit_weight_kg,
        box_weight_kg=body.box_weight_kg,
        box_count=body.box_count,
        units_per_box=body.units_per_box,
        cargo_price=body.cargo_price,
        name=body.name,
        category=body.category,
    )
    await db.flush()
    return product_to_out(product, expose_box_weight=True)


# ─── Yo'lovchilar buyurtmalari (ombor tasdiqlash) ───────────────────────────────


@router.get("/orders", response_model=list[WarehouseOrderOut])
async def pending_orders(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*WH_UZ)),
) -> list[WarehouseOrderOut]:
    """Yo'lovchilar bergan, ombor tasdiqlashi kerak bo'lgan buyurtmalar (donali+tekstil birga)."""
    orders = await list_pending_orders_for_warehouse(db)
    result: list[WarehouseOrderOut] = []
    for o in orders:
        carrier = o.carrier
        items = [
            WarehouseOrderItemOut(
                item_id=it.id,
                product_id=it.product_id,
                barcode=it.product.barcode,
                product_name=it.product.name,
                category=it.product.category,
                type=it.product.type,
                requested_amount=float(it.amount),
                actual_quantity=it.actual_quantity,
                actual_kg=float(it.actual_kg) if it.actual_kg is not None else None,
                confirmed=it.actual_quantity is not None,
                cargo_price=int(round(float(it.locked_cargo_price))),
            )
            for it in o.items
        ]
        result.append(
            WarehouseOrderOut(
                order_id=o.id,
                carrier_name=f"{carrier.first_name} {carrier.last_name}".strip(),
                carrier_number=carrier.carrier_number,
                pickup_type=o.pickup_type,
                pickup_address=o.pickup_address,
                delivery_address_tr=o.delivery_address_tr,
                status=o.status,
                created_at=o.created_at.date().isoformat(),
                items=items,
                all_confirmed=all(it.actual_quantity is not None for it in o.items),
            )
        )
    return result


@router.post(
    "/orders/{order_id}/items/{item_id}/confirm",
    response_model=ConfirmOrderItemResponse,
)
async def confirm_item(
    order_id: int,
    item_id: int,
    body: ConfirmOrderItemRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*WH_UZ)),
) -> ConfirmOrderItemResponse:
    """Buyurtmaning bitta mahsulotini tasdiqlash.
    Tekstil: actual_kg + actual_quantity. Donali: actual_quantity."""
    actual_kg = Decimal(str(body.actual_kg)) if body.actual_kg is not None else None
    item, product, carrier_id, order_confirmed = await confirm_order_item(
        db,
        order_id=order_id,
        item_id=item_id,
        actual_quantity=body.actual_quantity,
        actual_kg=actual_kg,
        confirmed_by=user.id,
    )
    if order_confirmed:
        await on_order_confirmed(db, carrier_id=carrier_id, order_id=order_id)

    return ConfirmOrderItemResponse(
        item_id=item.id,
        order_id=order_id,
        actual_quantity=item.actual_quantity or 0,
        actual_kg=float(item.actual_kg) if item.actual_kg is not None else None,
        barcode=product.barcode,
        print_url=build_print_url(product.barcode),
        order_confirmed=order_confirmed,
    )


@router.get("/products", response_model=list[ProductOut])
async def products(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*WH_UZ)),
) -> list[ProductOut]:
    """Ombordagi barcha mahsulotlar katalogi (har qanday holatdagi)."""
    rows = await db.execute(select(Product).order_by(Product.created_at.desc()))
    return [product_to_out(p, expose_box_weight=True) for p in rows.scalars().all()]


# ─── Scan / Confirm: kuryerga topshirish ────────────────────────────────────────


async def _scan_for_handover(db: AsyncSession, barcode: str) -> ScanResponse:
    product = await get_product_by_barcode(db, barcode)
    if product.status not in (
        ProductStatus.IN_WAREHOUSE_UZ,
        ProductStatus.CONFIRMED,
        ProductStatus.PENDING_ADMIN,
    ):
        raise AppError(
            "INVALID_PRODUCT_STATE",
            "Bu yuk topshirishga tayyor emas yoki allaqachon topshirilgan",
        )

    return ScanResponse(
        barcode=product.barcode,
        product_name=product.name,
        carrier_name=None,
        carrier_number=None,
        quantity=product.quantity,
    )


@router.post("/scan-for-courier", response_model=ScanResponse)
async def scan_for_courier(
    body: ScanRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*WH_UZ)),
) -> ScanResponse:
    return await _scan_for_handover(db, body.barcode)


@router.post("/confirm-courier-handover", response_model=OkResponse)
async def confirm_courier_handover(
    body: ConfirmRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*WH_UZ)),
) -> OkResponse:
    for barcode in body.barcodes:
        product = await get_product_by_barcode(db, barcode)
        await transfer_custody(
            db,
            product,
            to_holder_type=HolderType.COURIER_UZ,
            to_holder_id=None,
            event_type=CustodyEventType.HANDOVER_TO_COURIER_UZ,
            scanned_by=user.id,
        )
    return OkResponse(ok=True)
