from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_role
from app.bot.notify import notify_user, on_staff_approved
from app.core.enums import (
    DisputeStatus,
    HolderType,
    PaymentStatus,
    Role,
    StaffRequestStatus,
)
from app.core.errors import AppError
from app.db.base import get_db
from app.db.models import Dispute, Order, Payment, Product, StaffRequest, User
from app.schemas.admin import (
    AdminStats,
    ApproveStaffRequest,
    CarrierOut,
    DisputeOut,
    PaymentOut,
    StaffMemberOut,
    StaffRequestOut,
    UpdateDisputeRequest,
)
from app.schemas.common import OkResponse
from app.schemas.product import ProductOut
from app.schemas.serializers import product_to_out

router = APIRouter(prefix="/admin", tags=["admin"])

ROLE = (Role.ADMIN,)

# Adminning xodim rollari (tayinlash/almashtirish uchun ruxsat etilgan)
STAFF_ROLES = (
    Role.WAREHOUSE_UZ,
    Role.WAREHOUSE_TR,
    Role.COURIER_UZ,
    Role.COURIER_TR,
    Role.CHINA_WORKER,
)


@router.get("/stats", response_model=AdminStats)
async def stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> AdminStats:
    pending_staff = await db.scalar(
        select(func.count())
        .select_from(StaffRequest)
        .where(StaffRequest.status == StaffRequestStatus.PENDING)
    )
    active_carriers = await db.scalar(
        select(func.count())
        .select_from(User)
        .where(User.role == Role.CARRIER, User.is_active.is_(True))
    )
    total_products = await db.scalar(select(func.count()).select_from(Product))
    open_disputes = await db.scalar(
        select(func.count()).select_from(Dispute).where(Dispute.status == DisputeStatus.OPEN)
    )
    unpaid_payments = await db.scalar(
        select(func.count()).select_from(Payment).where(Payment.status == PaymentStatus.UNPAID)
    )
    return AdminStats(
        pending_staff=pending_staff or 0,
        active_carriers=active_carriers or 0,
        total_products=total_products or 0,
        open_disputes=open_disputes or 0,
        unpaid_payments=unpaid_payments or 0,
    )


# ─── Products (admin barcha mahsulotlarni ko'radi) ──────────────────────────────


@router.get("/products", response_model=list[ProductOut])
async def products(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> list[ProductOut]:
    rows = await db.execute(select(Product).order_by(Product.created_at.desc()))
    # Admin hamma narsani ko'radi (box_weight ham)
    return [product_to_out(p, expose_box_weight=True) for p in rows.scalars().all()]


# ─── Staff requests ─────────────────────────────────────────────────────────────


@router.get("/staff-requests", response_model=list[StaffRequestOut])
async def staff_requests(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> list[StaffRequestOut]:
    rows = await db.execute(
        select(StaffRequest, User)
        .join(User, User.id == StaffRequest.user_id)
        .where(StaffRequest.status == StaffRequestStatus.PENDING)
        .order_by(StaffRequest.created_at.desc())
    )
    return [
        StaffRequestOut(
            id=req.id,
            first_name=u.first_name,
            last_name=u.last_name,
            phone=u.phone,
            created_at=req.created_at.date().isoformat(),
        )
        for req, u in rows.all()
    ]


@router.post("/staff-requests/{request_id}/approve", response_model=OkResponse)
async def approve_staff(
    request_id: int,
    body: ApproveStaffRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> OkResponse:
    req = await db.get(StaffRequest, request_id)
    if req is None or req.status != StaffRequestStatus.PENDING:
        raise AppError("REQUEST_NOT_FOUND", "So'rov topilmadi")

    allowed = {
        Role.WAREHOUSE_UZ,
        Role.WAREHOUSE_TR,
        Role.COURIER_UZ,
        Role.COURIER_TR,
        Role.CHINA_WORKER,
    }
    if body.role not in allowed:
        raise AppError("INVALID_ROLE", "Bu rol berib bo'lmaydi")

    target = await db.get(User, req.user_id)
    if target is None:
        raise AppError("USER_NOT_FOUND", "Foydalanuvchi topilmadi")

    target.role = body.role
    target.is_active = True
    req.status = StaffRequestStatus.APPROVED
    await db.flush()
    await on_staff_approved(db, user_id=target.id, role=str(body.role))
    return OkResponse(ok=True)


@router.post("/staff-requests/{request_id}/reject", response_model=OkResponse)
async def reject_staff(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> OkResponse:
    req = await db.get(StaffRequest, request_id)
    if req is None or req.status != StaffRequestStatus.PENDING:
        raise AppError("REQUEST_NOT_FOUND", "So'rov topilmadi")
    req.status = StaffRequestStatus.REJECTED
    await db.flush()
    return OkResponse(ok=True)


# ─── Carriers ───────────────────────────────────────────────────────────────────


@router.get("/carriers", response_model=list[CarrierOut])
async def carriers(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> list[CarrierOut]:
    rows = await db.execute(
        select(User, func.count(Order.id))
        .outerjoin(Order, Order.carrier_id == User.id)
        .where(User.role == Role.CARRIER)
        .group_by(User.id)
        .order_by(User.carrier_number)
    )
    carriers_list = rows.all()

    # Hozir qaysi yo'lovchilarda yuk borligini aniqlaymiz (custody = yo'lovchida)
    cargo_rows = await db.execute(
        select(Product.custody_holder_id)
        .where(
            Product.custody_holder_type == HolderType.CARRIER,
            Product.custody_holder_id.is_not(None),
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


@router.post("/carriers/{user_id}/remove", response_model=OkResponse)
async def remove_carrier(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> OkResponse:
    """Yo'lovchini roldan olib tashlaydi — oddiy foydalanuvchiga (NEW) qaytaradi."""
    target = await db.get(User, user_id)
    if target is None:
        raise AppError("USER_NOT_FOUND", "Foydalanuvchi topilmadi")
    if target.role != Role.CARRIER:
        raise AppError("NOT_CARRIER", "Bu foydalanuvchi yo'lovchi emas")

    # Yo'lovchida hozir yuk bo'lsa — o'chirib bo'lmaydi
    has_cargo = await db.scalar(
        select(func.count())
        .select_from(Product)
        .where(
            Product.custody_holder_type == HolderType.CARRIER,
            Product.custody_holder_id == target.id,
        )
    )
    if has_cargo:
        raise AppError("HAS_CARGO", "Yo'lovchida yuk bor — avval topshirilishi kerak")

    target.role = Role.NEW
    await db.flush()
    await notify_user(
        db,
        target.id,
        "ℹ️ Sizning yo'lovchi rolingiz olib tashlandi.\nQaytadan rol tanlashingiz mumkin.",
    )
    return OkResponse(ok=True)


# ─── Staff (barcha tasdiqlangan xodimlar) ───────────────────────────────────────


@router.get("/staff", response_model=list[StaffMemberOut])
async def staff_members(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> list[StaffMemberOut]:
    """Barcha xodimlar (ombor, kuryer, Xitoy ishchisi) roli bilan."""
    rows = await db.execute(
        select(User).where(User.role.in_(STAFF_ROLES)).order_by(User.role, User.id)
    )
    return [
        StaffMemberOut(
            id=u.id,
            first_name=u.first_name,
            last_name=u.last_name,
            phone=u.phone,
            role=u.role,
            is_active=u.is_active,
        )
        for u in rows.scalars().all()
    ]


@router.post("/staff/{user_id}/role", response_model=OkResponse)
async def change_staff_role(
    user_id: int,
    body: ApproveStaffRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> OkResponse:
    """Xodimning rolini boshqa xodim roliga almashtiradi."""
    if body.role not in STAFF_ROLES:
        raise AppError("INVALID_ROLE", "Bu rol berib bo'lmaydi")
    target = await db.get(User, user_id)
    if target is None:
        raise AppError("USER_NOT_FOUND", "Foydalanuvchi topilmadi")
    if target.role not in STAFF_ROLES:
        raise AppError("NOT_STAFF", "Bu foydalanuvchi xodim emas")

    target.role = body.role
    target.is_active = True
    await db.flush()
    await on_staff_approved(db, user_id=target.id, role=str(body.role))
    return OkResponse(ok=True)


@router.post("/staff/{user_id}/remove", response_model=OkResponse)
async def remove_staff(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> OkResponse:
    """Xodimni roldan butunlay olib tashlaydi — oddiy foydalanuvchiga (orderer) qaytaradi."""
    target = await db.get(User, user_id)
    if target is None:
        raise AppError("USER_NOT_FOUND", "Foydalanuvchi topilmadi")
    if target.role not in STAFF_ROLES:
        raise AppError("NOT_STAFF", "Bu foydalanuvchi xodim emas")

    target.role = Role.ORDERER
    await db.flush()
    await notify_user(
        db,
        target.id,
        "ℹ️ Sizning xodim rolingiz olib tashlandi.\nEndi oddiy foydalanuvchi sifatida kirasiz.",
    )
    return OkResponse(ok=True)


# ─── Disputes ───────────────────────────────────────────────────────────────────


@router.get("/disputes", response_model=list[DisputeOut])
async def disputes(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> list[DisputeOut]:
    CarrierUser = User
    rows = await db.execute(
        select(Dispute, Product, CarrierUser)
        .outerjoin(Product, Product.id == Dispute.product_id)
        .outerjoin(CarrierUser, CarrierUser.id == Dispute.carrier_id)
        .order_by(Dispute.created_at.desc())
    )
    result: list[DisputeOut] = []
    for d, product, carrier in rows.all():
        result.append(
            DisputeOut(
                id=d.id,
                product_name=product.name if product else "",
                barcode=d.barcode,
                carrier_name=(
                    f"{carrier.first_name} {carrier.last_name}".strip() if carrier else ""
                ),
                carrier_number=carrier.carrier_number if carrier else None,
                note=d.note,
                status=d.status,
                created_at=d.created_at.date().isoformat(),
            )
        )
    return result


@router.post("/disputes/{dispute_id}/update", response_model=OkResponse)
async def update_dispute(
    dispute_id: int,
    body: UpdateDisputeRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> OkResponse:
    d = await db.get(Dispute, dispute_id)
    if d is None:
        raise AppError("DISPUTE_NOT_FOUND", "Nizo topilmadi")
    if body.status not in (DisputeStatus.RESOLVED, DisputeStatus.REJECTED):
        raise AppError("INVALID_STATUS", "Noto'g'ri holat")
    d.status = body.status
    await db.flush()
    return OkResponse(ok=True)


# ─── Payments ───────────────────────────────────────────────────────────────────


@router.get("/payments", response_model=list[PaymentOut])
async def payments(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> list[PaymentOut]:
    rows = await db.execute(
        select(Payment, User)
        .join(User, User.id == Payment.carrier_id)
        .order_by(Payment.created_at.desc())
    )
    return [
        PaymentOut(
            id=p.id,
            carrier_name=f"{u.first_name} {u.last_name}".strip(),
            carrier_number=u.carrier_number,
            products_count=p.products_count,
            total_amount=int(round(float(p.total_amount))),
            status=p.status,
        )
        for p, u in rows.all()
    ]


@router.post("/payments/{payment_id}/mark-paid", response_model=OkResponse)
async def mark_paid(
    payment_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> OkResponse:
    p = await db.get(Payment, payment_id)
    if p is None:
        raise AppError("PAYMENT_NOT_FOUND", "To'lov topilmadi")
    p.status = PaymentStatus.PAID
    p.paid_at = datetime.utcnow()
    await db.flush()
    return OkResponse(ok=True)
