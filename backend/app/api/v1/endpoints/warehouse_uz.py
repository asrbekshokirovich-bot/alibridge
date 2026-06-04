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
import secrets
import string
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import delete as sa_delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user, require_role
from app.api.deps.db import get_db_session
from app.domain.enums import (
    CustodyEventType,
    HandoffStatus,
    HolderType,
    OrderStatus,
    ProductStatus,
    Role,
)
from app.infra.db.models.custody import CustodyEvent
from app.infra.db.models.order import Order, OrderLine, SourcingSpec
from app.infra.db.models.product import Product
from app.infra.db.models.user import User
from app.services.intake_shipment import IntakeShipmentService


# Faqat shu holatlardagi mahsulotni WH xodimi o'chira oladi — ya'ni hali
# omborda turgan. Carrier olib ketgan (WITH_CARRIER) va undan keyingi holatlar
# custody/payout/dispute tarixiga bog'liq, o'chirilsa moliyaviy yozuvlar buziladi.
_DELETABLE_STATUSES: frozenset[str] = frozenset(
    {ProductStatus.AT_TASHKENT_WH.value, ProductStatus.IN_BASKET.value}
)


def _generate_short_code() -> str:
    """8 ta alphanumeric kod — kriptografik xavfsiz PRNG (MED-1 fix).
    I, O, 0, 1 chalkashmasligi uchun chiqarilgan."""
    chars = "".join(c for c in string.ascii_uppercase + string.digits if c not in "IO01")
    return "".join(secrets.choice(chars) for _ in range(8))

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

    # Savatni tasdiqlagan, lekin hali kelishi kutilayotgan yo'lovchilar
    from app.domain.enums import HandoffStatus
    from app.infra.db.models.carrier import CarrierPick
    awaiting = (await session.execute(
        select(func.count(CarrierPick.id)).where(
            CarrierPick.handoff_status == HandoffStatus.AWAITING_HANDOFF.value,
        )
    )).scalar_one()

    # Tasdiqlash kutayotgan buyurtmalar (orderer tomonidan yaratilgan, hali tasdiqlanmagan)
    pending_approvals = (await session.execute(
        select(func.count(Order.id)).where(
            Order.orderer_user_id.isnot(None),
            Order.wh_uz_approved_at.is_(None),
        )
    )).scalar_one()

    return {
        "pending_intake": pending,
        "in_warehouse": in_wh,
        "dispatched_today": dispatched,
        "awaiting_pickup": awaiting,
        "pending_approvals": pending_approvals,
    }


# ── Daily outgoing report ─────────────────────────────────────────────────────

@router.get("/daily-report")
async def daily_outgoing_report(
    days: int = Query(default=30, ge=1, le=90),
    _: User = Depends(require_role(Role.WAREHOUSE_UZ)),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Kunlik chiqim hisoboti — qaysi kuni nechta tovar chiqib ketgan."""
    from sqlalchemy import cast, Date as SADate

    stmt = (
        select(
            cast(CustodyEvent.at, SADate).label("day"),
            func.count(CustodyEvent.id).label("count"),
        )
        .where(
            CustodyEvent.event_type == CustodyEventType.DELIVERED_TO_CARRIER.value,
            CustodyEvent.from_holder_type == HolderType.TASHKENT_WH.value,
        )
        .group_by(cast(CustodyEvent.at, SADate))
        .order_by(cast(CustodyEvent.at, SADate).desc())
        .limit(days)
    )
    rows = (await session.execute(stmt)).all()
    return [
        {
            "date": str(r.day),
            "count": r.count,
        }
        for r in rows
    ]


# ── Products list ─────────────────────────────────────────────────────────────

@router.get("/products/specs")
async def list_warehouse_specs(
    _: User = Depends(require_role(Role.WAREHOUSE_UZ)),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Omborxonadagi mahsulotlar katalog bo'yicha guruhlangan.

    Faqat hozirda omborxonada turgan mahsulotlar (AT_TASHKENT_WH + IN_BASKET).
    Carrier olib ketsa (WITH_CARRIER va undan keyin) — sonda ko'rinmaydi.
    """
    warehouse_statuses = [
        ProductStatus.AT_TASHKENT_WH.value,
        ProductStatus.IN_BASKET.value,
    ]
    stmt = (
        select(
            SourcingSpec.id,
            SourcingSpec.title,
            SourcingSpec.photos,
            SourcingSpec.sourcing_mode,
            func.count(Product.id).label("count"),
            func.max(Product.box_items_count).label("box_items_count"),
            func.coalesce(func.sum(Product.unit_weight_g), 0).label("total_weight_g"),
            func.max(Product.created_at).label("last_created"),
        )
        .join(Product, Product.sourcing_spec_id == SourcingSpec.id)
        .where(Product.status.in_(warehouse_statuses))
        .group_by(SourcingSpec.id, SourcingSpec.title)
        .having(func.count(Product.id) > 0)
        .order_by(func.max(Product.created_at).desc())
    )
    rows = (await session.execute(stmt)).all()
    return [
        {
            "spec_id": str(r.id),
            "title": r.title,
            "photo": (list(r.photos)[0] if r.photos else None),
            "sourcing_mode": r.sourcing_mode or "piece",
            "box_items_count": r.box_items_count,   # quti/to'plamdagi dona soni (NULL = dona rejimi)
            "total_weight_g": int(r.total_weight_g or 0),
            "count": r.count,                       # dona soni (piece) yoki konteyner soni (box/textile)
            "last_created": r.last_created.isoformat() if r.last_created else None,
        }
        for r in rows
    ]


@router.get("/products/specs/{spec_id}/items")
async def list_warehouse_spec_items(
    spec_id: uuid.UUID,
    _: User = Depends(require_role(Role.WAREHOUSE_UZ)),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Bitta katalog ichidagi omborxonadagi mahsulotlar (AT_TASHKENT_WH + IN_BASKET)."""
    warehouse_statuses = [
        ProductStatus.AT_TASHKENT_WH.value,
        ProductStatus.IN_BASKET.value,
    ]
    rows = (await session.execute(
        select(Product)
        .where(
            Product.sourcing_spec_id == spec_id,
            Product.status.in_(warehouse_statuses),
        )
        .order_by(Product.created_at.asc())
    )).scalars().all()
    return [
        {
            "id": str(p.id),
            "short_code": p.short_code,
            "status": p.status,
            "unit_weight_g": p.unit_weight_g,
            "label_printed": p.label_printed_at is not None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "qr_payload": p.qr_payload,
        }
        for p in rows
    ]


@router.get("/products/{product_id}/qr")
async def get_product_qr(
    product_id: uuid.UUID,
    _: User = Depends(require_role(Role.WAREHOUSE_UZ)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Mahsulot QR kod rasmi (PNG base64)."""
    from app.infra.qr.signer import generate_qr_image

    product = await session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")

    png_bytes = generate_qr_image(product.qr_payload, box_size=8, border=2)
    return {
        "id": str(product.id),
        "short_code": product.short_code,
        "qr_image_b64": base64.b64encode(png_bytes).decode("ascii"),
    }


@router.post("/products/{product_id}/mark-printed")
async def mark_label_printed(
    product_id: uuid.UUID,
    _: User = Depends(require_role(Role.WAREHOUSE_UZ)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Mahsulot labelini chop etildi deb belgilash."""
    product = await session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")

    now = datetime.now(timezone.utc)
    product.label_printed_at = now
    product.label_attached_at = now
    await session.commit()
    return {"ok": True, "label_printed_at": now.isoformat()}


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


@router.get("/china-incoming")
async def china_incoming(
    _: User = Depends(require_role(Role.WAREHOUSE_UZ)),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Xitoydan yo'lda — qabul kutayotgan mahsulotlar (IN_TRANSIT_CN_UZ).

    Ombor xodimi bu mahsulotlarni QR orqali skanerlab qabul qiladi
    (scan context=CHINA_RECEIVE).
    """
    stmt = (
        select(
            Product.id,
            Product.short_code,
            Product.unit_weight_g,
            Product.color,
            SourcingSpec.title.label("spec_title"),
            SourcingSpec.photos,
        )
        .outerjoin(SourcingSpec, Product.sourcing_spec_id == SourcingSpec.id)
        .where(Product.status == ProductStatus.IN_TRANSIT_CN_UZ.value)
        .order_by(Product.created_at.asc())
    )
    rows = (await session.execute(stmt)).all()
    return [
        {
            "id": str(r.id),
            "short_code": r.short_code,
            "spec_title": r.spec_title or "Noma'lum",
            "photo": (list(r.photos)[0] if r.photos else None),
            "unit_weight_g": r.unit_weight_g or 0,
            "color": r.color,
        }
        for r in rows
    ]


class IntakeRequest(BaseModel):
    order_id: str
    lines: list[dict]  # [{"line_id": str, "count_received": int, "cargo_price": float, "cargo_currency": str}]


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
        p.label_attached_at = now

    await session.commit()
    return {"marked": len(products)}


# ── Pending Pickups (carrier tasdiqlagan savat) ────────────────────────────────

@router.get("/pending-pickups")
async def pending_pickups(
    _: User = Depends(require_role(Role.WAREHOUSE_UZ)),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Carrier tomonidan tasdiqlangan, lekin hali olib ketilmagan mahsulotlar.

    CarrierPick.handoff_status = AWAITING_HANDOFF bo'lgan barcha pick'lar,
    carrier bo'yicha guruhlangan holda.
    """
    from app.domain.enums import HandoffStatus
    from app.infra.db.models.carrier import CarrierPick
    from app.infra.db.models.user import User as UserModel
    from sqlalchemy.orm import selectinload

    stmt = (
        select(CarrierPick)
        .options(
            selectinload(CarrierPick.product).selectinload(Product.sourcing_spec),
        )
        .where(CarrierPick.handoff_status.in_([
            HandoffStatus.AWAITING_HANDOFF.value,
            HandoffStatus.CARRIER_HAS_CUSTODY.value,
        ]))
        .order_by(CarrierPick.picked_at.desc())
    )
    picks = list((await session.execute(stmt)).scalars().all())

    # Carrier user ma'lumotlarini yuklash
    carrier_ids = list({p.carrier_user_id for p in picks})
    users_map: dict = {}
    if carrier_ids:
        users_result = await session.execute(
            select(UserModel).where(UserModel.id.in_(carrier_ids))
        )
        for u in users_result.scalars().all():
            users_map[u.id] = u

    # Carrier bo'yicha guruhlash
    groups: dict = {}
    for pick in picks:
        cid = str(pick.carrier_user_id)
        if cid not in groups:
            carrier_user = users_map.get(pick.carrier_user_id)
            groups[cid] = {
                "carrier_id": cid,
                "carrier_name": (carrier_user.full_name or carrier_user.telegram_username or cid[:8])
                if carrier_user else cid[:8],
                "telegram_username": carrier_user.telegram_username if carrier_user else None,
                "items": [],
                "total_weight_g": 0,
                "all_picked": False,  # barcha mahsulotlar CARRIER_HAS_CUSTODY ga o'tganmi
                "pending_approval": False,  # WH tasdig'i kutilmoqdami
                "approved": False,          # WH tasdiqlaganmi
                # Yetkazib berish tafsilotlari (birinchi pick'dan — bir checkout bir xil)
                "uz_method": pick.handoff_mode,
                "uz_address": pick.delivery_address_uz,
                "tr_method": pick.tr_delivery_mode,
                "tr_address": pick.carrier_address_tr,
            }
        product = pick.product
        spec = product.sourcing_spec if product else None
        groups[cid]["items"].append({
            "pick_id": str(pick.id),
            "short_code": product.short_code if product else "",
            "spec_title": spec.title if spec else "Noma'lum",
            "unit_weight_g": product.unit_weight_g if product else 0,
            "locked_cargo_price": str(pick.locked_cargo_price),
            "locked_currency": pick.locked_currency,
            "picked": pick.handoff_status == HandoffStatus.CARRIER_HAS_CUSTODY.value,
        })
        groups[cid]["total_weight_g"] += product.unit_weight_g if product else 0
        # Tasdiq holati
        if (
            pick.handoff_status == HandoffStatus.AWAITING_HANDOFF.value
            and pick.wh_approved_at is None
            and pick.wh_rejected_at is None
        ):
            groups[cid]["pending_approval"] = True
        if pick.wh_approved_at is not None:
            groups[cid]["approved"] = True

    # all_picked: faqat CARRIER_HAS_CUSTODY bo'lsa True
    for g in groups.values():
        g["all_picked"] = all(item["picked"] for item in g["items"])

    return list(groups.values())


# ── Carrier pick tasdiqlash / rad etish ────────────────────────────────────────

class RejectPicksRequest(BaseModel):
    reason: str | None = None


async def _pending_picks_for_carrier(session: AsyncSession, carrier_id: uuid.UUID) -> list:
    """Carrier'ning tasdiq kutayotgan (AWAITING_HANDOFF, hali tasdiq/rad bo'lmagan) pick'lari."""
    from app.infra.db.models.carrier import CarrierPick
    from sqlalchemy.orm import selectinload

    stmt = (
        select(CarrierPick)
        .options(selectinload(CarrierPick.product))
        .where(
            CarrierPick.carrier_user_id == carrier_id,
            CarrierPick.handoff_status == HandoffStatus.AWAITING_HANDOFF.value,
            CarrierPick.wh_approved_at.is_(None),
            CarrierPick.wh_rejected_at.is_(None),
        )
    )
    return list((await session.execute(stmt)).scalars().all())


@router.post("/picks/{carrier_id}/approve", status_code=200)
async def approve_carrier_picks(
    carrier_id: uuid.UUID,
    _: User = Depends(require_role(Role.WAREHOUSE_UZ)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Yo'lovchining savatini (barcha kutayotgan pick'lar) tasdiqlash."""
    picks = await _pending_picks_for_carrier(session, carrier_id)
    if not picks:
        raise HTTPException(status_code=404, detail="Tasdiqlanadigan buyurtma topilmadi")

    now = datetime.now(timezone.utc)
    for p in picks:
        p.wh_approved_at = now
    await session.commit()

    from app.infra.telegram.notify import notify_user_id

    await notify_user_id(
        session,
        carrier_id,
        "✅ Ombor administratori buyurtmangizni tasdiqladi. Iltimos, jo'natishni kuting.",
    )
    return {"approved": len(picks)}


@router.post("/picks/{carrier_id}/reject", status_code=200)
async def reject_carrier_picks(
    carrier_id: uuid.UUID,
    body: RejectPicksRequest,
    _: User = Depends(require_role(Role.WAREHOUSE_UZ)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Yo'lovchining savatini rad etish — mahsulotlar omborga qaytadi."""
    picks = await _pending_picks_for_carrier(session, carrier_id)
    if not picks:
        raise HTTPException(status_code=404, detail="Rad etiladigan buyurtma topilmadi")

    reason = (body.reason or "").strip() or "Sabab ko'rsatilmagan"
    now = datetime.now(timezone.utc)
    for p in picks:
        p.wh_rejected_at = now
        p.rejection_reason = reason
        p.handoff_status = HandoffStatus.CANCELLED.value
        if p.product and p.product.status == ProductStatus.IN_BASKET.value:
            p.product.status = ProductStatus.AT_TASHKENT_WH.value
    await session.commit()

    from app.infra.telegram.notify import notify_user_id

    await notify_user_id(
        session,
        carrier_id,
        f"❌ Buyurtmangiz ombor tomonidan rad etildi.\nSabab: {reason}",
    )
    return {"rejected": len(picks)}


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
    name: str                          # "Samsung A33"
    quantity: int = Field(gt=0, le=10000)   # dona soni (piece) yoki quti/to'plam soni (box/textile)
    weight_g: int = Field(gt=0)        # 1 dona (piece) yoki 1 konteyner (box/textile) og'irligi, gramm
    category: str | None = None        # "Telefonlar", "Krasovkalar" va h.k.
    cargo_price: Decimal = Field(default=Decimal("0"), ge=0)  # UZ→TR kargo narxi (carrier katalogida ko'rinadi)
    cargo_currency: str = "USD"        # narx valyutasi
    total_value: Decimal = Field(default=Decimal("0"), ge=0)  # 1 dona mahsulot qiymati (yo'qotilsa qarz shu summa)
    total_value_currency: str = "USD"  # qiymat valyutasi
    photos: list[str] = Field(default_factory=list)  # mahsulot rasmlari (URL)
    # Intake rejimi: piece (dona) | box (quti) | textile (to'plam)
    mode: Literal["piece", "box", "textile"] = "piece"
    # box/textile: har konteyner (quti/to'plam) ichidagi dona soni
    items_per_container: int | None = Field(default=None, gt=0)


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

    # Tezkor qabul: BITTA yorliq (to'plam). box_items_count = umumiy dona soni.
    # Tekstil avtomatik "Tekstil" kategoriyasiga tushadi.
    category = "Tekstil" if body.mode == "textile" else body.category

    # 1. SourcingSpec — bu batch uchun "katalog" yozuvi
    spec = SourcingSpec(
        title=body.name,
        default_weight_g=body.weight_g,
        is_customer_orderable=False,
        category=category,
        photos=body.photos or [],  # ← katalogda ko'rinadigan mahsulot rasmlari
        sourcing_mode=body.mode,
    )
    session.add(spec)
    await session.flush()  # spec.id olish uchun

    # 2. BITTA Product — to'plam sifatida. box_items_count = umumiy dona soni.
    # Har dona uchun alohida yorliq emas, bitta yorliq (nomi+sana+soni+barcode).
    pid = uuid.uuid4()
    code = _generate_short_code()
    qr_payload = signer.encode(pid)
    now = datetime.now(timezone.utc)
    session.add(Product(
        id=pid,
        sourcing_spec_id=spec.id,
        order_line_id=None,  # standalone — ordersiz
        short_code=code,
        qr_payload=qr_payload,
        barcode_payload=code,
        unit_weight_g=body.weight_g,
        box_items_count=body.quantity,   # ← umumiy dona soni (1 yorliq, N dona)
        cargo_price_uz_to_tr=body.cargo_price,
        cargo_currency=body.cargo_currency,
        declared_value=body.total_value or None,
        declared_currency=body.total_value_currency,
        intake_photo_url=(body.photos[0] if body.photos else None),
        status=ProductStatus.AT_TASHKENT_WH.value,
        custody_holder_type=HolderType.TASHKENT_WH.value,
        custody_holder_id=current_user.id,
        label_attached_at=now,
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

    await session.commit()
    return {
        "spec_id": str(spec.id),
        "count": body.quantity,
        "products": [{"id": str(pid), "short_code": code, "qr_payload": qr_payload}],
    }


@router.delete("/products/specs/{spec_id}", status_code=200)
async def delete_spec_and_products(
    spec_id: uuid.UUID,
    _: User = Depends(require_role(Role.WAREHOUSE_UZ)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Katalog va uning barcha mahsulotlarini o'chirish."""
    from app.infra.db.models.carrier import CarrierPick
    from app.infra.db.models.dispute import Dispute
    from app.infra.db.models.payout import PayoutLine

    # Spec ichida carrier olib ketgan mahsulot bo'lsa — butun katalogni
    # o'chirish custody/payout tarixini buzadi. Faqat omboridagilarni o'chiramiz.
    all_ids = (await session.execute(
        select(Product.id).where(Product.sourcing_spec_id == spec_id)
    )).scalars().all()
    product_ids = (await session.execute(
        select(Product.id).where(
            Product.sourcing_spec_id == spec_id,
            Product.status.in_(_DELETABLE_STATUSES),
        )
    )).scalars().all()
    remaining = len(all_ids) - len(product_ids)

    if product_ids:
        pick_ids = (await session.execute(
            select(CarrierPick.id).where(CarrierPick.product_id.in_(product_ids))
        )).scalars().all()
        if pick_ids:
            await session.execute(sa_delete(PayoutLine).where(PayoutLine.carrier_pick_id.in_(pick_ids)))
        await session.execute(sa_delete(CarrierPick).where(CarrierPick.product_id.in_(product_ids)))
        await session.execute(sa_delete(CustodyEvent).where(CustodyEvent.product_id.in_(product_ids)))
        await session.execute(sa_delete(Dispute).where(Dispute.product_id.in_(product_ids)))
        await session.execute(sa_delete(Product).where(Product.id.in_(product_ids)))

    # Spec'ni faqat unga bog'liq mahsulot qolmagandagina o'chiramiz.
    if remaining == 0:
        spec = await session.get(SourcingSpec, spec_id)
        if spec:
            await session.delete(spec)
    await session.commit()
    return {"deleted": True, "products_count": len(product_ids), "remaining": remaining}


@router.delete("/products/bulk", status_code=200)
async def bulk_delete_warehouse_products(
    ids: str = Query(..., description="Vergul bilan ajratilgan product ID lar"),
    _: User = Depends(require_role(Role.WAREHOUSE_UZ)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Bir nechta mahsulotni bir vaqtda o'chirish."""
    from app.infra.db.models.carrier import CarrierPick
    from app.infra.db.models.dispute import Dispute
    from app.infra.db.models.payout import PayoutLine

    raw_ids = [i.strip() for i in ids.split(",") if i.strip()]
    if not raw_ids:
        raise HTTPException(status_code=400, detail="ID lar bo'sh")
    if len(raw_ids) > 500:   # MED-9 fix: maksimal 500 ta
        raise HTTPException(status_code=400, detail="Bir vaqtda maksimal 500 ta o'chirish mumkin")
    try:
        requested_ids = [uuid.UUID(i) for i in raw_ids]
    except ValueError:
        raise HTTPException(status_code=400, detail="UUID format noto'g'ri")

    # Faqat omborda turgan mahsulotlarni o'chirish — carrier'dagilar o'tkazib
    # yuboriladi (custody/payout tarixi buzilmasligi uchun).
    product_ids = (await session.execute(
        select(Product.id).where(
            Product.id.in_(requested_ids),
            Product.status.in_(_DELETABLE_STATUSES),
        )
    )).scalars().all()
    skipped = len(requested_ids) - len(product_ids)

    if product_ids:
        pick_ids = (await session.execute(
            select(CarrierPick.id).where(CarrierPick.product_id.in_(product_ids))
        )).scalars().all()
        if pick_ids:
            await session.execute(sa_delete(PayoutLine).where(PayoutLine.carrier_pick_id.in_(pick_ids)))
        await session.execute(sa_delete(CarrierPick).where(CarrierPick.product_id.in_(product_ids)))
        await session.execute(sa_delete(CustodyEvent).where(CustodyEvent.product_id.in_(product_ids)))
        await session.execute(sa_delete(Dispute).where(Dispute.product_id.in_(product_ids)))
        await session.execute(sa_delete(Product).where(Product.id.in_(product_ids)))
    await session.commit()
    return {"deleted": len(product_ids), "skipped": skipped}


@router.delete("/products/{product_id}", status_code=200)
async def delete_product(
    product_id: uuid.UUID,
    _: User = Depends(require_role(Role.WAREHOUSE_UZ)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Mahsulotni o'chirish — bog'liq yozuvlar (custody) ham o'chiriladi."""
    from app.infra.db.models.carrier import CarrierPick
    from app.infra.db.models.dispute import Dispute
    from app.infra.db.models.payout import PayoutLine

    product = await session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")

    # Faqat omborda turgan mahsulotni o'chirish mumkin. Carrier olib ketgan
    # (yoki undan keyingi holat) mahsulotni o'chirish custody/payout/dispute
    # tarixini buzadi — bloklanadi.
    if product.status not in _DELETABLE_STATUSES:
        raise HTTPException(
            status_code=409,
            detail="Bu mahsulot omborda emas (yo'lovchida/yetkazilmoqda) — o'chirib bo'lmaydi",
        )

    pick_ids = (await session.execute(
        select(CarrierPick.id).where(CarrierPick.product_id == product_id)
    )).scalars().all()
    if pick_ids:
        await session.execute(
            sa_delete(PayoutLine).where(PayoutLine.carrier_pick_id.in_(pick_ids))
        )
    await session.execute(sa_delete(CarrierPick).where(CarrierPick.product_id == product_id))
    await session.execute(sa_delete(CustodyEvent).where(CustodyEvent.product_id == product_id))
    await session.execute(sa_delete(Dispute).where(Dispute.product_id == product_id))
    await session.delete(product)
    await session.commit()
    return {"deleted": True, "product_id": str(product_id)}


@router.get("/products/specs/{spec_id}/pdf")
async def download_spec_labels_pdf(
    spec_id: str,
    _: User = Depends(require_role(Role.WAREHOUSE_UZ)),
    session: AsyncSession = Depends(get_db_session),
):
    """Barcha mahsulotlar uchun label PDF — barcode printer uchun.

    Har bir yorliq bir xil formatda:
      - Tepada: mahsulot nomi + kiritilgan sana
      - O'rtada: Code128 barcode (tagida o'qiladigan kod)
      - Pastda: mahsulot nomi + kiritilgan sana (takror)
    Har sahifada 3 ustun x 8 qator = 24 ta yorliq.
    """
    from io import BytesIO
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas
    from reportlab.lib import colors
    from reportlab.graphics.barcode.code128 import Code128
    from fastapi.responses import StreamingResponse

    stmt = (
        select(Product, SourcingSpec.title.label("spec_title"))
        .outerjoin(SourcingSpec, Product.sourcing_spec_id == SourcingSpec.id)
        .where(
            Product.sourcing_spec_id == uuid.UUID(spec_id),
            Product.custody_holder_type == HolderType.TASHKENT_WH.value,
            Product.status == ProductStatus.AT_TASHKENT_WH.value,
        )
        .order_by(Product.created_at.asc())
    )
    rows = (await session.execute(stmt)).all()

    if not rows:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")

    spec_title = rows[0].spec_title or "Mahsulot"

    def _fmt_date(dt: datetime | None) -> str:
        if not dt:
            return ""
        return dt.strftime("%d.%m.%Y")

    def _fit(text: str, max_len: int) -> str:
        return (text[: max_len - 1] + "…") if len(text) > max_len else text

    # ── PDF yaratish ──────────────────────────────────────────────
    buf = BytesIO()
    page_w, page_h = A4  # 595 x 842 pt

    COLS = 3
    ROWS = 8
    MARGIN = 10 * mm
    LABEL_W = (page_w - 2 * MARGIN) / COLS
    LABEL_H = (page_h - 2 * MARGIN) / ROWS

    c = canvas.Canvas(buf, pagesize=A4)

    for page_start in range(0, len(rows), COLS * ROWS):
        page_items = rows[page_start: page_start + COLS * ROWS]

        for i, row in enumerate(page_items):
            product = row.Product
            col = i % COLS
            row_idx = i // COLS

            x = MARGIN + col * LABEL_W
            y = page_h - MARGIN - (row_idx + 1) * LABEL_H
            cx = x + LABEL_W / 2

            date_str = _fmt_date(product.created_at)
            title_short = _fit(spec_title, 26)
            qty = product.box_items_count or 1
            qty_str = f"{qty} dona" if qty > 1 else ""

            # Label chegarasi
            c.setStrokeColor(colors.lightgrey)
            c.setLineWidth(0.3)
            c.rect(x, y, LABEL_W, LABEL_H)

            # ── Tepada: nomi + sana + soni ──
            c.setFillColor(colors.black)
            c.setFont("Helvetica-Bold", 7)
            c.drawCentredString(cx, y + LABEL_H - 5 * mm, title_short)
            c.setFont("Helvetica", 6)
            c.setFillColor(colors.grey)
            top_meta = f"{date_str}  ·  {qty_str}" if qty_str else date_str
            c.drawCentredString(cx, y + LABEL_H - 8.5 * mm, top_meta)

            # ── O'rtada: Code128 barcode ──
            bc = Code128(
                product.barcode_payload or product.short_code,
                barHeight=10 * mm,
                barWidth=0.32 * mm,
                humanReadable=True,
            )
            bc_w = bc.width
            # Yorliqqa sig'masa barWidth'ni kichraytirish
            if bc_w > LABEL_W - 6 * mm:
                scale = (LABEL_W - 6 * mm) / bc_w
                bc = Code128(
                    product.barcode_payload or product.short_code,
                    barHeight=10 * mm,
                    barWidth=0.32 * mm * scale,
                    humanReadable=True,
                )
                bc_w = bc.width
            bc.drawOn(c, x + (LABEL_W - bc_w) / 2, y + LABEL_H / 2 - 5 * mm)

            # ── Pastda: nomi + sana + soni (takror) ──
            c.setFillColor(colors.black)
            c.setFont("Helvetica-Bold", 7)
            c.drawCentredString(cx, y + 5 * mm, title_short)
            c.setFont("Helvetica", 6)
            c.setFillColor(colors.grey)
            c.drawCentredString(cx, y + 2 * mm, top_meta)

        if page_start + COLS * ROWS < len(rows):
            c.showPage()

    c.save()
    buf.seek(0)

    filename = f"labels_{spec_title[:20].replace(' ', '_')}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


def _barcode_png(payload: str) -> bytes:
    """Code128 barcode'ni PNG bytes sifatida qaytaradi (ekranda ko'rsatish uchun)."""
    from io import BytesIO
    import barcode
    from barcode.writer import ImageWriter

    bc = barcode.get("code128", payload, writer=ImageWriter())
    buf = BytesIO()
    bc.write(buf, options={
        "module_height": 12.0,
        "font_size": 10,
        "text_distance": 3.0,
        "quiet_zone": 2.0,
    })
    return buf.getvalue()


@router.get("/quick-intake/{spec_id}/labels")
async def quick_intake_labels(
    spec_id: str,
    _: User = Depends(require_role(Role.WAREHOUSE_UZ)),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Tezkor qabul uchun barcode rasmlari (PNG base64).

    Har bir yorliq uchun: id, short_code, name, date, qty, barcode_image_b64
    """
    stmt = (
        select(Product, SourcingSpec.title.label("spec_title"))
        .outerjoin(SourcingSpec, Product.sourcing_spec_id == SourcingSpec.id)
        .where(Product.sourcing_spec_id == uuid.UUID(spec_id))
        .order_by(Product.created_at.asc())
    )
    rows = (await session.execute(stmt)).all()

    if not rows:
        raise HTTPException(status_code=404, detail="Bu spec uchun mahsulot topilmadi")

    result = []
    for row in rows:
        p = row.Product
        png_bytes = _barcode_png(p.barcode_payload or p.short_code)
        result.append({
            "id": str(p.id),
            "short_code": p.short_code,
            "name": row.spec_title or "Mahsulot",
            "date": p.created_at.strftime("%d.%m.%Y") if p.created_at else "",
            "qty": p.box_items_count or 1,
            "barcode_image_b64": base64.b64encode(png_bytes).decode("ascii"),
        })
    return result


# ── Order approval ─────────────────────────────────────────────────────────────

@router.get("/pending-approvals")
async def list_pending_approvals(
    _: User = Depends(require_role(Role.WAREHOUSE_UZ)),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Tasdiqlash kutayotgan buyurtmalar (orderer tomonidan yaratilgan)."""
    from sqlalchemy.orm import selectinload
    from app.infra.db.models.order import OrderLine

    result = await session.execute(
        select(Order)
        .options(selectinload(Order.lines).selectinload(OrderLine.sourcing_spec))
        .where(
            Order.orderer_user_id.isnot(None),
            Order.wh_uz_approved_at.is_(None),
        )
        .order_by(Order.created_at.asc())
    )
    orders = list(result.scalars().all())
    return [
        {
            "id": str(o.id),
            "order_number": str(o.id)[:8].upper(),
            "status": o.status,
            "created_at": o.created_at.isoformat(),
            "notes": o.notes or "",
            "total_items": sum(l.quantity for l in (o.lines or [])),
            "lines": [
                {
                    "spec_title": l.sourcing_spec.title if l.sourcing_spec else "Noma'lum",
                    "quantity": l.quantity,
                    "notes": l.notes or "",
                }
                for l in (o.lines or [])
            ],
        }
        for o in orders
    ]


@router.post("/orders/{order_id}/approve", status_code=200)
async def approve_order(
    order_id: uuid.UUID,
    current_user: User = Depends(require_role(Role.WAREHOUSE_UZ)),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Buyurtmani tasdiqlash."""
    order = await session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Buyurtma topilmadi")
    if order.wh_uz_approved_at is not None:
        raise HTTPException(status_code=409, detail="Buyurtma allaqachon tasdiqlangan")

    order.wh_uz_approved_at = datetime.now(timezone.utc)
    await session.commit()
    return {"approved": True, "order_id": str(order_id)}
