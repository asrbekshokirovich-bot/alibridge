from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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
from app.db.models import (
    CustodyEvent,
    CustodyHolding,
    Order,
    OrderItem,
    Product,
    ProductVariant,
    User,
)
from app.schemas.admin import CarrierOut
from app.schemas.common import OkResponse
from app.schemas.product import ProductOut
from app.schemas.serializers import product_to_out
from app.schemas.warehouse import (
    AddVariantRequest,
    ConfirmOrderItemRequest,
    ConfirmOrderItemResponse,
    ConfirmRequest,
    CourierOption,
    DailyOutItem,
    DailyOutReport,
    HeldCargoItem,
    ProductDistribution,
    ReceiveGoodsRequest,
    ReceiveGoodsResponse,
    ScanRequest,
    ScanResponse,
    StageQuantity,
    UpdateProductRequest,
    VariantAvailability,
    WarehouseOrderItemOut,
    WarehouseOrderOut,
    WarehouseUzStats,
)
from app.services.barcode_service import (
    apply_variant_fields,
    build_print_url,
    create_received_product,
    recompute_product_totals,
)
from app.services.custody_service import (
    STAGE_LABELS,
    availability_for_holder,
    resolve_variant_id,
    sync_warehouse_holding,
    transfer_custody,
)
from app.services.order_service import (
    confirm_order_item,
    list_pending_orders_for_warehouse,
)
from app.services.storage_service import upload_product_image

# Rasm yuklash chegaralari
MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB (siqishdan oldin)
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}

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
    # Mahsulot hali bo'sh (variant yo'q, quantity=0). Custody holding
    # variant qo'shilganda (add_variant -> sync_warehouse_holding) yaratiladi.
    # Denormalizatsiyani ko'rsatuv uchun WAREHOUSE_UZ ga qo'yamiz.
    product.custody_holder_type = HolderType.WAREHOUSE_UZ
    product.custody_holder_id = 0
    await db.flush()
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
    """Mahsulot nom/kategoriya/tur ni yangilaydi (miqdor/vazn variantlardan).
    Faqat omborda turgan (in_warehouse_uz) mahsulotni o'zgartirish mumkin."""
    product = await db.get(Product, product_id, options=[selectinload(Product.variants)])
    if product is None:
        raise AppError("PRODUCT_NOT_FOUND", "Mahsulot topilmadi", status_code=404)
    if product.status != ProductStatus.IN_WAREHOUSE_UZ:
        raise AppError(
            "PRODUCT_LOCKED",
            "Bu mahsulot allaqachon jarayonga o'tgan, o'zgartirib bo'lmaydi",
        )
    if body.name is not None:
        product.name = body.name
    if body.category is not None:
        product.category = body.category
    product.type = body.type
    await db.flush()
    return product_to_out(product, expose_box_weight=True)


# ─── O'lcham variantlari ────────────────────────────────────────────────────────


async def _get_editable_product(db: AsyncSession, product_id: int) -> Product:
    product = await db.get(Product, product_id, options=[selectinload(Product.variants)])
    if product is None:
        raise AppError("PRODUCT_NOT_FOUND", "Mahsulot topilmadi", status_code=404)
    if product.status != ProductStatus.IN_WAREHOUSE_UZ:
        raise AppError(
            "PRODUCT_LOCKED",
            "Bu mahsulot allaqachon jarayonga o'tgan, o'zgartirib bo'lmaydi",
        )
    return product


@router.post("/products/{product_id}/variants", response_model=ProductOut)
async def add_variant(
    product_id: int,
    body: AddVariantRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*WH_UZ)),
) -> ProductOut:
    """Mahsulotga yangi o'lcham varianti qo'shadi. Tur Product darajasida yangilanadi."""
    product = await _get_editable_product(db, product_id)
    product.type = body.type
    variant = ProductVariant(product_id=product.id, position=len(product.variants))
    apply_variant_fields(
        variant,
        ptype=body.type,
        size_label=body.size_label,
        quantity=body.quantity,
        weight_kg=body.weight_kg,
        tare_kg=body.tare_kg,
        unit_weight_kg=body.unit_weight_kg,
        box_weight_kg=body.box_weight_kg,
        box_count=body.box_count,
        units_per_box=body.units_per_box,
        cargo_price=body.cargo_price,
    )
    product.variants.append(variant)
    await db.flush()
    recompute_product_totals(product)
    await db.flush()
    # Ombor qoldig'i (WAREHOUSE_UZ holding) yangi variant miqdoriga tenglashtiriladi
    await sync_warehouse_holding(db, variant)
    return product_to_out(product, expose_box_weight=True)


@router.delete("/products/{product_id}/variants/{variant_id}", response_model=ProductOut)
async def delete_variant(
    product_id: int,
    variant_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*WH_UZ)),
) -> ProductOut:
    """O'lcham variantini o'chiradi."""
    product = await _get_editable_product(db, product_id)
    variant = next((v for v in product.variants if v.id == variant_id), None)
    if variant is None:
        raise AppError("VARIANT_NOT_FOUND", "O'lcham topilmadi", status_code=404)
    product.variants.remove(variant)
    await db.flush()
    recompute_product_totals(product)
    await db.flush()
    return product_to_out(product, expose_box_weight=True)


@router.delete("/products/{product_id}", response_model=OkResponse)
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*WH_UZ)),
) -> OkResponse:
    """Mahsulotni butunlay o'chiradi (variantlari bilan).

    Faqat hali omborda turgan (jarayonga o'tmagan) mahsulot o'chiriladi.
    Buyurtmaga kiritilgan yoki custody tarixi bor mahsulot o'chirilmaydi —
    aks holda tarix/hisob buziladi.
    """
    product = await db.get(Product, product_id, options=[selectinload(Product.variants)])
    if product is None:
        raise AppError("PRODUCT_NOT_FOUND", "Mahsulot topilmadi", status_code=404)
    if product.status != ProductStatus.IN_WAREHOUSE_UZ:
        raise AppError(
            "PRODUCT_LOCKED",
            "Bu mahsulot allaqachon jarayonga o'tgan, o'chirib bo'lmaydi",
        )

    # Buyurtmaga kiritilgan bo'lsa — o'chirib bo'lmaydi (hisob buziladi)
    in_order = await db.scalar(
        select(OrderItem.id).where(OrderItem.product_id == product_id).limit(1)
    )
    if in_order is not None:
        raise AppError(
            "PRODUCT_IN_ORDER",
            "Bu mahsulot buyurtmaga kiritilgan, o'chirib bo'lmaydi",
        )

    # custody_events append-only — birlamchi RECEIVED yozuvi har doim bo'ladi.
    # Faqat keyingi harakat (boshqa joyga jo'natilgan) bo'lsa o'chirib bo'lmaydi.
    has_movement = await db.scalar(
        select(CustodyEvent.id)
        .where(
            CustodyEvent.product_id == product_id,
            CustodyEvent.event_type != CustodyEventType.RECEIVED,
        )
        .limit(1)
    )
    if has_movement is not None:
        raise AppError(
            "PRODUCT_HAS_HISTORY",
            "Bu mahsulotda harakat tarixi bor, o'chirib bo'lmaydi",
        )

    # Mahsulotni butunlay o'chiramiz. Bog'liq yozuvlar (variantlar, custody_events,
    # disputes) ON DELETE CASCADE bilan avtomatik o'chadi (0007 migration).
    await db.delete(product)
    await db.flush()
    return OkResponse(ok=True)


@router.post("/products/{product_id}/image", response_model=ProductOut)
async def upload_image(
    product_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*WH_UZ)),
) -> ProductOut:
    """Mahsulot rasmini yuklaydi (telefon kamerasi surati).
    Rasm siqilib Supabase Storage'ga yuklanadi, image_url yangilanadi."""
    product = await db.get(Product, product_id, options=[selectinload(Product.variants)])
    if product is None:
        raise AppError("PRODUCT_NOT_FOUND", "Mahsulot topilmadi", status_code=404)
    if product.status != ProductStatus.IN_WAREHOUSE_UZ:
        raise AppError(
            "PRODUCT_LOCKED",
            "Bu mahsulot allaqachon jarayonga o'tgan, rasm o'zgartirib bo'lmaydi",
        )
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise AppError("INVALID_IMAGE_TYPE", "Faqat rasm fayli yuklash mumkin (jpg/png)")

    raw = await file.read()
    if len(raw) > MAX_IMAGE_BYTES:
        raise AppError("IMAGE_TOO_LARGE", "Rasm hajmi juda katta (maks 10 MB)")
    if not raw:
        raise AppError("EMPTY_IMAGE", "Bo'sh fayl yuborildi")

    product.image_url = await upload_product_image(raw, product_id)
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
                variant_id=it.variant_id,
                size_label=it.variant.size_label if it.variant else "",
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
    rows = await db.execute(
        select(Product).options(selectinload(Product.variants)).order_by(Product.created_at.desc())
    )
    return [product_to_out(p, expose_box_weight=True) for p in rows.scalars().all()]


# ─── Scan / Confirm: kuryerga topshirish ────────────────────────────────────────


async def _scan_for_handover(db: AsyncSession, barcode: str) -> ScanResponse:
    product = await db.scalar(
        select(Product).options(selectinload(Product.variants)).where(Product.barcode == barcode)
    )
    if product is None:
        raise AppError("BARCODE_NOT_FOUND", "Barkod topilmadi", status_code=400)

    # Omborda (WAREHOUSE_UZ, holder_id=0) shu mahsulotdan nechta qolgan
    avail = await availability_for_holder(
        db, product=product, holder_type=HolderType.WAREHOUSE_UZ, holder_id=0
    )
    if not avail:
        raise AppError(
            "INVALID_PRODUCT_STATE",
            "Omborda bu yukdan qolmagan yoki o'lcham qo'shilmagan",
        )

    return ScanResponse(
        barcode=product.barcode,
        product_name=product.name,
        quantity=sum(a[2] for a in avail),
        available_by_variant=[
            VariantAvailability(variant_id=vid, size_label=sl, available=q) for vid, sl, q in avail
        ],
    )


@router.get("/couriers", response_model=list[CourierOption])
async def list_couriers(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*WH_UZ)),
) -> list[CourierOption]:
    """Toshkent kuryerlari — topshirishda tanlash uchun."""
    rows = await db.execute(
        select(User)
        .where(User.role == Role.COURIER_UZ, User.is_active.is_(True))
        .order_by(User.first_name)
    )
    return [
        CourierOption(
            id=u.id,
            first_name=u.first_name,
            last_name=u.last_name or "",
            phone=u.phone or "",
        )
        for u in rows.scalars().all()
    ]


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
    # Kuryer tanlangan bo'lishi shart — yuk aynan shu kuryerga o'tadi,
    # shunda kuryerning "Mening yuklarim" oynasida ko'rinadi.
    if body.courier_id is None:
        raise AppError("COURIER_REQUIRED", "Avval kuryerni tanlang")
    courier = (
        await db.execute(
            select(User).where(User.id == body.courier_id, User.role == Role.COURIER_UZ)
        )
    ).scalar_one_or_none()
    if courier is None:
        raise AppError("COURIER_NOT_FOUND", "Kuryer topilmadi")

    for item in body.items:
        product = await db.scalar(
            select(Product)
            .options(selectinload(Product.variants))
            .where(Product.barcode == item.barcode)
        )
        if product is None:
            raise AppError("BARCODE_NOT_FOUND", f"Barkod topilmadi: {item.barcode}")
        variant_id = await resolve_variant_id(db, product=product, variant_id=item.variant_id)
        # Ombordan (WAREHOUSE_UZ, 0) kuryerga. COURIER_UZ_PICKUP eventi —
        # kuryer o'zi olgani bilan bir xil, my-products hech o'zgarishsiz ishlaydi.
        await transfer_custody(
            db,
            product,
            variant_id=variant_id,
            quantity=item.quantity,
            from_holder_type=HolderType.WAREHOUSE_UZ,
            from_holder_id=0,
            to_holder_type=HolderType.COURIER_UZ,
            to_holder_id=courier.id,
            event_type=CustodyEventType.COURIER_UZ_PICKUP,
            scanned_by=user.id,
        )
    return OkResponse(ok=True)


# ─── Yo'lovchilar (ombor: ko'rish + yuk tafsiloti) ──────────────────────────────


@router.get("/carriers", response_model=list[CarrierOut])
async def warehouse_carriers(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*WH_UZ)),
) -> list[CarrierOut]:
    """Barcha yo'lovchilar — reys soni va hozir yuki bor-yo'qligi bilan."""
    rows = await db.execute(
        select(User, func.count(Order.id))
        .outerjoin(Order, Order.carrier_id == User.id)
        .where(User.role == Role.CARRIER)
        .group_by(User.id)
        .order_by(User.carrier_number)
    )
    carriers_list = rows.all()

    # Yo'lovchida yuk bor-yo'qligi — custody_holdings (CARRIER, quantity>0) dan
    cargo_rows = await db.execute(
        select(CustodyHolding.holder_id)
        .where(
            CustodyHolding.holder_type == HolderType.CARRIER,
            CustodyHolding.quantity > 0,
        )
        .distinct()
    )
    with_cargo = {row[0] for row in cargo_rows.all()}

    return [
        CarrierOut(
            id=u.id,
            first_name=u.first_name,
            last_name=u.last_name,
            phone=u.phone,
            carrier_number=u.carrier_number,
            is_active=u.is_active,
            total_trips=trips,
            has_cargo=u.id in with_cargo,
        )
        for u, trips in carriers_list
    ]


@router.get("/carriers/{carrier_id}/products", response_model=list[HeldCargoItem])
async def carrier_products(
    carrier_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*WH_UZ)),
) -> list[HeldCargoItem]:
    """Bitta yo'lovchi hozir olib ketayotgan yuklar — har o'lcham aniq miqdor bilan."""
    rows = await db.execute(
        select(CustodyHolding, Product, ProductVariant)
        .join(Product, Product.id == CustodyHolding.product_id)
        .join(ProductVariant, ProductVariant.id == CustodyHolding.variant_id)
        .where(
            CustodyHolding.holder_type == HolderType.CARRIER,
            CustodyHolding.holder_id == carrier_id,
            CustodyHolding.quantity > 0,
        )
        .order_by(Product.created_at.desc())
    )
    return [
        HeldCargoItem(
            product_id=p.id,
            barcode=p.barcode,
            product_name=p.name,
            type=p.type,
            size_label=v.size_label,
            quantity=h.quantity,
        )
        for h, p, v in rows.all()
    ]


# ─── Barcha yuklar (ombor: kuzatuv, status filtri frontendda) ───────────────────


@router.get("/all-products", response_model=list[ProductOut])
async def all_products(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*WH_UZ)),
) -> list[ProductOut]:
    """Tizimdagi barcha yuklar — har qanday statusda (kuzatish uchun)."""
    rows = await db.execute(
        select(Product).options(selectinload(Product.variants)).order_by(Product.created_at.desc())
    )
    return [product_to_out(p, expose_box_weight=True) for p in rows.scalars().all()]


@router.get("/products/{product_id}/distribution", response_model=ProductDistribution)
async def product_distribution(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*WH_UZ)),
) -> ProductDistribution:
    """Bir mahsulotning bosqichlar bo'ylab taqsimoti: qaysi bosqichda nechta."""
    product = await db.get(Product, product_id)
    if product is None:
        raise AppError("PRODUCT_NOT_FOUND", "Mahsulot topilmadi", status_code=404)
    rows = await db.execute(
        select(CustodyHolding.holder_type, func.sum(CustodyHolding.quantity))
        .where(CustodyHolding.product_id == product_id, CustodyHolding.quantity > 0)
        .group_by(CustodyHolding.holder_type)
    )
    by_stage: dict[str, int] = {ht: int(q or 0) for ht, q in rows.all()}
    stages = [
        StageQuantity(holder_type=ht.value, label=label, quantity=by_stage.get(ht.value, 0))
        for ht, label in STAGE_LABELS.items()
        if by_stage.get(ht.value, 0) > 0
    ]
    return ProductDistribution(
        product_id=product.id,
        barcode=product.barcode,
        product_name=product.name,
        total=sum(s.quantity for s in stages),
        stages=stages,
    )


async def build_daily_out(
    db: AsyncSession,
    *,
    day: date,
    from_types: list[HolderType] | None = None,
    to_types: list[HolderType] | None = None,
) -> DailyOutReport:
    """Berilgan kunda ombor(lar)ga oid kunlik custody eventlar hisoboti.

    from_types berilsa — ombor(lar)dan CHIQQAN yuklar (from_holder_type mos).
    to_types berilsa — ombor(lar)ga KELGAN yuklar (to_holder_type mos).
    """
    start = datetime.combine(day, datetime.min.time())
    end = datetime.combine(day, datetime.max.time())
    stmt = (
        select(CustodyEvent, Product, ProductVariant, User)
        .join(Product, Product.id == CustodyEvent.product_id)
        .outerjoin(ProductVariant, ProductVariant.id == CustodyEvent.variant_id)
        .outerjoin(User, User.id == CustodyEvent.scanned_by)
        .where(
            CustodyEvent.created_at >= start,
            CustodyEvent.created_at <= end,
            CustodyEvent.quantity > 0,
        )
        .order_by(CustodyEvent.created_at.desc())
    )
    if from_types is not None:
        stmt = stmt.where(CustodyEvent.from_holder_type.in_(from_types))
    if to_types is not None:
        stmt = stmt.where(CustodyEvent.to_holder_type.in_(to_types))
    rows = await db.execute(stmt)
    items: list[DailyOutItem] = []
    for ev, p, v, u in rows.all():
        from_label = STAGE_LABELS.get(ev.from_holder_type, ev.from_holder_type or "")
        to_label = STAGE_LABELS.get(ev.to_holder_type, ev.to_holder_type or "")
        items.append(
            DailyOutItem(
                barcode=p.barcode,
                product_name=p.name,
                size_label=v.size_label if v else "",
                quantity=ev.quantity,
                from_label=from_label,
                to_label=to_label,
                by_name=(f"{u.first_name} {u.last_name}".strip() if u else ""),
                time=ev.created_at.strftime("%H:%M"),
            )
        )
    return DailyOutReport(
        date=day.isoformat(),
        total=sum(i.quantity for i in items),
        items=items,
    )


@router.get("/daily-out", response_model=DailyOutReport)
async def daily_out(
    date_str: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*WH_UZ)),
) -> DailyOutReport:
    """Toshkent ombordan kunlik chiqqan yuklar (default bugun)."""
    day = date.fromisoformat(date_str) if date_str else date.today()
    return await build_daily_out(db, day=day, from_types=[HolderType.WAREHOUSE_UZ])
