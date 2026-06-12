from datetime import date, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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
from app.core.security import hash_password
from app.db.base import get_db
from app.db.models import (
    CustodyEvent,
    CustodyHolding,
    Dispute,
    Order,
    Payment,
    Product,
    StaffRequest,
    User,
    WalkInCustomer,
)
from app.schemas.admin import (
    AdminStats,
    ApproveStaffRequest,
    CarrierOut,
    DisputeOut,
    PaymentOut,
    SetCredentialsRequest,
    StaffMemberOut,
    StaffRequestOut,
    UpdateDisputeRequest,
)
from app.api.v1.endpoints.warehouse_uz import build_daily_out
from app.schemas.common import OkResponse
from app.schemas.product import ProductOut
from app.schemas.serializers import product_to_out
from app.schemas.warehouse import DailyOutReport

router = APIRouter(prefix="/admin", tags=["admin"])

ROLE = (Role.ADMIN,)

# Nizolar (disputes) — admin + Toshkent ombor xodimi ko'radi va hal qiladi
DISPUTE_ROLE = (Role.ADMIN, Role.WAREHOUSE_UZ)

# Faqat ko'rish (read-only) — admin + Toshkent ombor xodimi yuk harakatini kuzatadi
VIEW_ROLE = (Role.ADMIN, Role.WAREHOUSE_UZ)

# Adminning xodim rollari (tayinlash/almashtirish uchun ruxsat etilgan)
STAFF_ROLES = (
    Role.WAREHOUSE_UZ,
    Role.WAREHOUSE_TR,
    Role.COURIER_UZ,
    Role.COURIER_TR,
    Role.CHINA_WORKER,
)


async def _has_work_history(db: AsyncSession, user_id: int) -> bool:
    """User biror ish tarixi qoldirganmi (skanlash/mahsulot/dispute).

    custody_events append-only bo'lgani uchun bunday yozuvlarni o'chirib/null
    qilib bo'lmaydi — shu sababli tarixli userni o'chirish taqiqlanadi.
    """
    for stmt in (
        select(CustodyEvent.id).where(CustodyEvent.scanned_by == user_id),
        select(Product.id).where(Product.created_by == user_id),
        select(Dispute.id).where(Dispute.reported_by == user_id),
        select(WalkInCustomer.id).where(WalkInCustomer.created_by == user_id),
    ):
        if await db.scalar(stmt.limit(1)) is not None:
            return True
    return False


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
    user: User = Depends(require_role(*VIEW_ROLE)),
) -> list[ProductOut]:
    rows = await db.execute(
        select(Product).options(selectinload(Product.variants)).order_by(Product.created_at.desc())
    )
    # Admin hamma narsani ko'radi (box_weight ham)
    return [product_to_out(p, expose_box_weight=True) for p in rows.scalars().all()]


@router.get("/daily-out", response_model=DailyOutReport)
async def daily_out(
    date_str: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*VIEW_ROLE)),
) -> DailyOutReport:
    """Ikkala ombordan (Toshkent + Turkiya) kunlik chiqqan yuklar (default bugun)."""
    day = date.fromisoformat(date_str) if date_str else date.today()
    return await build_daily_out(
        db, day=day, from_types=[HolderType.WAREHOUSE_UZ, HolderType.WAREHOUSE_TR]
    )


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
    user: User = Depends(require_role(*VIEW_ROLE)),
) -> list[CarrierOut]:
    rows = await db.execute(
        select(User, func.count(Order.id))
        .outerjoin(Order, Order.carrier_id == User.id)
        .where(User.role == Role.CARRIER)
        .group_by(User.id)
        .order_by(User.carrier_number)
    )
    carriers_list = rows.all()

    # Hozir qaysi yo'lovchilarda yuk borligini aniqlaymiz (custody_holdings — CARRIER)
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


@router.post("/carriers/{user_id}/remove", response_model=OkResponse)
async def remove_carrier(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> OkResponse:
    """Yo'lovchini butunlay o'chiradi — user bazadan o'chadi, botdan ham uchadi.

    Yuk, buyurtma yoki to'lov tarixi bo'lsa o'chirib bo'lmaydi (avval tozalansin).
    """
    target = await db.get(User, user_id)
    if target is None:
        raise AppError("USER_NOT_FOUND", "Foydalanuvchi topilmadi")
    if target.role != Role.CARRIER:
        raise AppError("NOT_CARRIER", "Bu foydalanuvchi yo'lovchi emas")

    # Yo'lovchida hozir yuk bo'lsa — o'chirib bo'lmaydi
    has_cargo = await db.scalar(
        select(func.count())
        .select_from(CustodyHolding)
        .where(
            CustodyHolding.holder_type == HolderType.CARRIER,
            CustodyHolding.holder_id == target.id,
            CustodyHolding.quantity > 0,
        )
    )
    if has_cargo:
        raise AppError("HAS_CARGO", "Yo'lovchida yuk bor — avval topshirilishi kerak")

    # Buyurtma yoki to'lov tarixi bo'lsa — o'chirib bo'lmaydi (moliyaviy tarix saqlanadi)
    has_orders = await db.scalar(
        select(func.count()).select_from(Order).where(Order.carrier_id == target.id)
    )
    has_payments = await db.scalar(
        select(func.count()).select_from(Payment).where(Payment.carrier_id == target.id)
    )
    if has_orders or has_payments or await _has_work_history(db, target.id):
        raise AppError(
            "HAS_HISTORY", "Yo'lovchida buyurtma/to'lov tarixi bor — o'chirib bo'lmaydi"
        )

    # O'chirishdan oldin xabar yuboramiz
    await notify_user(
        db,
        target.id,
        "ℹ️ Sizning yo'lovchi rolingiz olib tashlandi va hisobingiz o'chirildi.\n"
        "Qaytadan kirish uchun /start ni bosing.",
    )
    # Dispute'lar carrier_id null bo'lishi mumkin — yetim qilmaymiz
    await db.execute(
        update(Dispute).where(Dispute.carrier_id == target.id).values(carrier_id=None)
    )
    await db.execute(delete(StaffRequest).where(StaffRequest.user_id == target.id))
    await db.delete(target)
    await db.flush()
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
            username=u.username,
        )
        for u in rows.scalars().all()
    ]


@router.post("/staff/{user_id}/credentials", response_model=OkResponse)
async def set_staff_credentials(
    user_id: int,
    body: SetCredentialsRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*ROLE)),
) -> OkResponse:
    """Xodimga sayt (brauzer) orqali kirish uchun login + parol o'rnatadi."""
    target = await db.get(User, user_id)
    if target is None:
        raise AppError("USER_NOT_FOUND", "Foydalanuvchi topilmadi")
    if target.role not in STAFF_ROLES:
        raise AppError("NOT_STAFF", "Bu foydalanuvchi xodim emas")

    # username band emasligini tekshiramiz (o'zinikidan boshqa)
    clash = await db.scalar(
        select(User.id).where(User.username == body.username, User.id != user_id)
    )
    if clash is not None:
        raise AppError("USERNAME_TAKEN", "Bu login allaqachon band")

    target.username = body.username
    target.password_hash = hash_password(body.password)
    await db.flush()
    return OkResponse(ok=True)


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
    """Xodimni butunlay o'chiradi — user bazadan o'chadi, botdan ham uchadi.

    Ish tarixi (skanlash, mahsulot, dispute) bo'lsa o'chirib bo'lmaydi —
    custody_events append-only bo'lgani uchun yozuvlar saqlanishi shart.
    O'chirilgandan keyin user qaytadan /start bosib ro'yxatdan o'tishi kerak.
    """
    target = await db.get(User, user_id)
    if target is None:
        raise AppError("USER_NOT_FOUND", "Foydalanuvchi topilmadi")
    if target.role not in STAFF_ROLES:
        raise AppError("NOT_STAFF", "Bu foydalanuvchi xodim emas")

    if await _has_work_history(db, target.id):
        raise AppError(
            "HAS_HISTORY", "Xodimda ish tarixi bor — o'chirib bo'lmaydi"
        )

    # O'chirishdan oldin xabar yuboramiz (keyin user qoldmaydi)
    await notify_user(
        db,
        target.id,
        "ℹ️ Sizning xodim rolingiz olib tashlandi va hisobingiz o'chirildi.\n"
        "Qaytadan kirish uchun /start ni bosing.",
    )
    await db.execute(delete(StaffRequest).where(StaffRequest.user_id == target.id))
    await db.delete(target)
    await db.flush()
    return OkResponse(ok=True)


# ─── Disputes ───────────────────────────────────────────────────────────────────


@router.get("/disputes", response_model=list[DisputeOut])
async def disputes(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(*DISPUTE_ROLE)),
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
    user: User = Depends(require_role(*DISPUTE_ROLE)),
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
