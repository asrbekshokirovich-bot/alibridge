"""
Warehouse UZ endpoints — Toshkentdagi ombor xodimi uchun.

Mavjud endpointlar:
  GET  /warehouse/uz/stats                       — dashboard statistikasi
  GET  /warehouse/uz/intake/pending              — qabul kutayotgan buyurtmalar
  POST /warehouse/uz/intake                      — tovarlarni qabul qilish
  POST /warehouse/uz/quick-intake                — tezkor qabul (ordersiz)
  GET  /warehouse/uz/quick-intake/{id}/labels    — QR kod rasmlari
  GET  /warehouse/uz/labels/pending              — label bosilmagan mahsulotlar
  POST /warehouse/uz/labels/print/{id}           — label chop etish
  POST /warehouse/uz/scan                        — QR skanerlash (ma'lumotlar)

Barcha endpoint'lar WAREHOUSE_UZ roli talab qiladi.
"""
from __future__ import annotations

import base64
import random
import string
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user, require_role
from app.api.deps.db import get_db_session
from app.domain.enums import CustodyEventType, HolderType, OrderStatus, ProductStatus, Role
from app.infra.db.models.custody import CustodyEvent
from app.infra.db.models.order import Order, OrderLine, SourcingSpec
from app.infra.db.models.product import Product
from app.infra.db.models.user import User
from app.services.intake_shipment import IntakeShipmentService


def _generate_short_code() -> str:
    """8 ta alphanumeric kod (I, O, 0, 1 chalkashmasligi uchun chiqarilgan)."""
    chars = "".join(c for c in string.ascii_uppercase + string.digits if c not in "IO01")
    return "".join(random.choices(chars, k=8))

router = APIRouter()


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def warehouse_stats(
    _: User = Depends(require_role(Role.WAREHOUSE_UZ)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Dashboard statistikasi — 3 ta raqam."""
    # AT_TASHKENT status'idagi buyurtmalar (qabul kutayotgan)
    pending = (await session.execute(
        select(func.count(Order.id)).where(
            Order.status == OrderStatus.AT_TASHKENT.value
        )
    )).scalar_one()

    # Omborxonadagi mahsulotlar (AT_TASHKENT_WH)
    in_wh = (await session.execute(
        select(func.count(Product.id)).where(
            Product.custody_holder_type == HolderType.TASHKENT_WH.value,
            Product.status == ProductStatus.AT_TASHKENT_WH.value,
        )
    )).scalar_one()

    # Yo'lovchiga berilgan mahsulotlar (WITH_CARRIER)
    dispatched = (await session.execute(
        select(func.count(Product.id)).where(
            Product.status == ProductStatus.WITH_CARRIER.value,
        )
    )).scalar_one()

    return {
        "pending_intake": pending,
        "in_warehouse": in_wh,
        "dispatched_today": dispatched,
    }


# ── Intake ────────────────────────────────────────────────────────────────────

@router.get("/intake/pending")
async def pending_intake(
    skip: int = Query(default=0, ge=0, description="Nechta yozuvni o'tkazib yuborish"),
    limit: int = Query(default=50, ge=1, le=200, description="Maksimal yozuvlar soni"),
    _: User = Depends(require_role(Role.WAREHOUSE_UZ)),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Qabul kutayotgan buyurtmalar ro'yxati (paginatsiya bilan)."""
    orders_stmt = (
        select(Order)
        .where(Order.status == OrderStatus.AT_TASHKENT.value)
        .order_by(Order.created_at.asc())
        .offset(skip)
        .limit(limit)
    )
    orders = (await session.execute(orders_stmt)).scalars().all()

    result = []
    for order in orders:
        lines_stmt = (
            select(OrderLine, SourcingSpec.title.label("spec_title"))
            .outerjoin(SourcingSpec, OrderLine.sourcing_spec_id == SourcingSpec.id)
            .where(OrderLine.order_id == order.id)
        )
        lines_rows = (await session.execute(lines_stmt)).all()

        result.append({
            "id": str(order.id),
            "order_number": f"ORD-{str(order.id)[:8].upper()}",
            "lines": [
                {
                    "id": str(line.id),
                    "spec_title": spec_title or "Noma'lum",
                    "quantity": line.quantity,
                }
                for line, spec_title in lines_rows
            ],
        })

    return result


class IntakeRequest(BaseModel):
    order_id: str
    lines: list[dict]  # [{"line_id": str, "count_received": int}]


@router.post("/intake")
async def intake_shipment(
    body: IntakeRequest,
    current_user: User = Depends(require_role(Role.WAREHOUSE_UZ)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Tovarlarni qabul qilish — mahsulot passportlari yaratish."""
    service = IntakeShipmentService(session=session)
    result = await service.process(
        order_id=body.order_id,
        warehouse_worker_id=str(current_user.id),
        line_counts=body.lines,
    )
    await session.commit()

    return {
        "order_id": result.order_id,
        "total_products_created": result.total_products_created,
        "has_discrepancy": result.has_discrepancy,
        "lines": [
            {
                "line_id": lr.line_id,
                "spec_title": lr.spec_title,
                "expected": lr.expected,
                "count_received": lr.received,
                "discrepancy": lr.discrepancy.value,
            }
            for lr in result.lines
        ],
    }


# ── Labels ────────────────────────────────────────────────────────────────────

@router.get("/labels/pending")
async def pending_labels(
    _: User = Depends(require_role(Role.WAREHOUSE_UZ)),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Label bosilmagan mahsulotlar buyurtma bo'yicha guruhlanib."""
    stmt = (
        select(Product, OrderLine.order_id)
        .join(OrderLine, Product.order_line_id == OrderLine.id)
        .where(
            Product.status == ProductStatus.AT_TASHKENT_WH.value,
            Product.custody_holder_type == HolderType.TASHKENT_WH.value,
        )
        .order_by(Product.created_at.asc())
    )
    rows = (await session.execute(stmt)).all()

    order_groups: dict[str, dict] = {}
    for product, order_id in rows:
        oid = str(order_id)
        if oid not in order_groups:
            order_groups[oid] = {
                "id": oid,
                "order_number": f"ORD-{oid[:8].upper()}",
                "product_count": 0,
                "label_printed_at": None,
            }
        order_groups[oid]["product_count"] += 1
        if product.label_printed_at and order_groups[oid]["label_printed_at"] is None:
            order_groups[oid]["label_printed_at"] = product.label_printed_at.isoformat()

    return list(order_groups.values())


@router.post("/labels/print/{order_id}")
async def print_labels(
    order_id: str,
    _: User = Depends(require_role(Role.WAREHOUSE_UZ)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Label chop etish — label_printed_at belgilash. PDF keyinchalik qo'shiladi."""
    stmt = (
        select(Product)
        .join(OrderLine, Product.order_line_id == OrderLine.id)
        .where(
            OrderLine.order_id == uuid.UUID(order_id),
            Product.status == ProductStatus.AT_TASHKENT_WH.value,
        )
    )
    products = (await session.execute(stmt)).scalars().all()

    if not products:
        raise HTTPException(status_code=404, detail="Bu order uchun mahsulot topilmadi")

    now = datetime.now(timezone.utc)
    for p in products:
        p.label_printed_at = now

    await session.commit()
    return {"pdf_url": None}  # TODO: ReportLab PDF generator qo'shilganda to'ldiriladi


# ── Scan ──────────────────────────────────────────────────────────────────────

class ScanRequest(BaseModel):
    qr_payload: str


@router.post("/scan")
async def scan_product(
    body: ScanRequest,
    _: User = Depends(require_role(Role.WAREHOUSE_UZ)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """QR payload'ni tekshirish — mahsulot ma'lumotlarini qaytarish.

    Bu endpoint custody event YARATMAYDI — faqat mahsulot ma'lumotlarini ko'rsatadi.
    """
    from app.infra.qr.signer import InvalidQrPayloadError, QrSigner
    from app.core.config import settings

    signer = QrSigner(secret=settings.qr_hmac_secret)
    try:
        product_id = signer.decode(body.qr_payload)
    except InvalidQrPayloadError:
        raise HTTPException(status_code=400, detail="Noto'g'ri QR kod")

    stmt = (
        select(Product, SourcingSpec.title.label("spec_title"))
        .outerjoin(SourcingSpec, Product.sourcing_spec_id == SourcingSpec.id)
        .where(Product.id == product_id)
    )
    row = (await session.execute(stmt)).first()

    if not row:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")

    product, spec_title = row
    return {
        "product_id": str(product.id),
        "short_code": product.short_code,
        "status": product.status,
        "spec_title": spec_title or "Noma'lum",
    }


# ── Quick Intake (ordersiz tezkor qabul) ──────────────────────────────────────

class QuickIntakeRequest(BaseModel):
    name: str       # "Samsung A33"
    quantity: int   # 30
    weight_g: int   # 150 (bir dona uchun gramm)


@router.post("/quick-intake")
async def quick_intake(
    body: QuickIntakeRequest,
    current_user: User = Depends(require_role(Role.WAREHOUSE_UZ)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Tezkor qabul — buyurtmasiz tovarlarni qabul qilish.

    Yangi SourcingSpec yaratadi (batch identifikatori) + N ta Product passport.
    Har bir mahsulot uchun QR payload va short_code generatsiya qilinadi.
    """
    from app.infra.qr.signer import QrSigner
    from app.core.config import settings

    signer = QrSigner(secret=settings.qr_hmac_secret)

    # 1. SourcingSpec — bu batch uchun "katalog" yozuvi
    spec = SourcingSpec(
        title=body.name,
        default_weight_g=body.weight_g,
        is_customer_orderable=False,
    )
    session.add(spec)
    await session.flush()  # spec.id olish uchun

    # 2. N ta Product yaratish
    products_out = []
    for _ in range(body.quantity):
        pid = uuid.uuid4()
        code = _generate_short_code()
        qr_payload = signer.encode(pid)

        session.add(Product(
            id=pid,
            sourcing_spec_id=spec.id,
            order_line_id=None,  # standalone — ordersiz
            short_code=code,
            qr_payload=qr_payload,
            barcode_payload=code,
            unit_weight_g=body.weight_g,
            cargo_price_uz_to_tr=Decimal("0"),
            status=ProductStatus.AT_TASHKENT_WH.value,
            custody_holder_type=HolderType.TASHKENT_WH.value,
            custody_holder_id=current_user.id,
        ))
        session.add(CustodyEvent(
            id=uuid.uuid4(),
            product_id=pid,
            event_type=CustodyEventType.CREATED.value,
            from_holder_type=None,
            from_holder_id=None,
            to_holder_type=HolderType.TASHKENT_WH.value,
            to_holder_id=current_user.id,
            actor_user_id=current_user.id,
        ))
        products_out.append({
            "id": str(pid),
            "short_code": code,
            "qr_payload": qr_payload,
        })

    await session.commit()
    return {
        "spec_id": str(spec.id),
        "count": body.quantity,
        "products": products_out,
    }


@router.get("/quick-intake/{spec_id}/labels")
async def quick_intake_labels(
    spec_id: str,
    _: User = Depends(require_role(Role.WAREHOUSE_UZ)),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Tezkor qabul uchun QR kod rasmlari (PNG base64).

    Har bir mahsulot uchun: id, short_code, qr_image_b64
    """
    from app.infra.qr.signer import generate_qr_image

    stmt = (
        select(Product)
        .where(Product.sourcing_spec_id == uuid.UUID(spec_id))
        .order_by(Product.created_at.asc())
    )
    products = (await session.execute(stmt)).scalars().all()

    if not products:
        raise HTTPException(status_code=404, detail="Bu spec uchun mahsulot topilmadi")

    result = []
    for p in products:
        png_bytes = generate_qr_image(p.qr_payload, box_size=8, border=2)
        result.append({
            "id": str(p.id),
            "short_code": p.short_code,
            "qr_image_b64": base64.b64encode(png_bytes).decode("ascii"),
        })
    return result
