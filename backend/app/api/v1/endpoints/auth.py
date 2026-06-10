from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.bot.notify import on_staff_request
from app.core.enums import RegType, Role, StaffRequestStatus
from app.core.errors import AppError
from app.core.limiter import limiter
from app.core.security import create_access_token, verify_init_data, verify_password
from app.db.base import get_db
from app.db.models import StaffRequest, User
from app.schemas.auth import RegisterRequest, RegisterResponse, UserOut
from app.services.auth_service import register_user
from app.services.counter_service import next_value

router = APIRouter(tags=["auth"])


class LoginRequest(BaseModel):
    tg_init_data: str = Field(max_length=4096)


class WebLoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=4, max_length=128)


class SelectRoleRequest(BaseModel):
    role: Role


# Foydalanuvchi Mini App ichida erkin tanlay oladigan rollar (xodim emas)
SELF_ROLES = {Role.ORDERER, Role.CARRIER}
# Rol almashtirishga ruxsat etilgan holatlar (xodim/admin himoyalangan)
SWITCHABLE_ROLES = {Role.NEW, Role.ORDERER, Role.CARRIER, Role.PENDING}
# Sayt (brauzer) orqali kirishga ruxsat etilgan rollar — xodim/admin
WEB_LOGIN_ROLES = {
    Role.ADMIN,
    Role.WAREHOUSE_UZ,
    Role.WAREHOUSE_TR,
    Role.COURIER_UZ,
    Role.COURIER_TR,
    Role.CHINA_WORKER,
}


@router.post("/auth/login", response_model=RegisterResponse)
@limiter.limit("20/minute")
async def login(
    request: Request,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> RegisterResponse:
    """Telegram initData orqali avtomatik login.

    Foydalanuvchi ro'yxatda bo'lsa — token qaytaradi.
    Ro'yxatda bo'lmasa 404 (frontend ro'yxatdan o'tishga yo'naltiradi).
    """
    tg = verify_init_data(body.tg_init_data)
    user = await db.scalar(select(User).where(User.telegram_id == tg["id"]))
    if user is None:
        raise AppError("USER_NOT_FOUND", "Ro'yxatdan o'tilmagan", status_code=404)
    if not user.is_active:
        raise AppError("FORBIDDEN", "Hisob faol emas", status_code=403)

    token = create_access_token(user.id, str(user.role))
    return RegisterResponse(token=token, user=UserOut.model_validate(user, from_attributes=True))


@router.post("/auth/web-login", response_model=RegisterResponse)
@limiter.limit("10/minute")
async def web_login(
    request: Request,
    body: WebLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> RegisterResponse:
    """Sayt (brauzer) orqali username + parol bilan kirish.

    Faqat xodim/admin rollari kira oladi (yo'lovchi/buyurtmachi botda qoladi).
    """
    user = await db.scalar(select(User).where(User.username == body.username))
    # Foydalanuvchi yo'q yoki parol noto'g'ri — bir xil javob (foydalanuvchi borligini oshkor qilmaymiz)
    if user is None or not verify_password(body.password, user.password_hash):
        raise AppError("INVALID_CREDENTIALS", "Login yoki parol noto'g'ri", status_code=401)
    if not user.is_active:
        raise AppError("FORBIDDEN", "Hisob faol emas", status_code=403)
    if user.role not in WEB_LOGIN_ROLES:
        raise AppError("FORBIDDEN", "Sayt orqali kirish ruxsat etilmagan", status_code=403)

    token = create_access_token(user.id, str(user.role))
    return RegisterResponse(token=token, user=UserOut.model_validate(user, from_attributes=True))


@router.post("/auth/register", response_model=RegisterResponse)
@limiter.limit("10/minute")
async def register(
    request: Request,
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> RegisterResponse:
    tg = verify_init_data(body.tg_init_data)

    user, _is_new = await register_user(
        db,
        telegram_id=tg["id"],
        first_name=body.first_name or tg.get("first_name", ""),
        last_name=body.last_name or tg.get("last_name", ""),
        phone=body.phone,
        passport=body.passport,
        reg_type=body.reg_type,
    )

    if _is_new and body.reg_type == RegType.STAFF:
        await on_staff_request(db, name=f"{user.first_name} {user.last_name}".strip())

    token = create_access_token(user.id, str(user.role))
    return RegisterResponse(token=token, user=UserOut.model_validate(user, from_attributes=True))


@router.get("/auth/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user, from_attributes=True)


@router.post("/auth/select-role", response_model=RegisterResponse)
@limiter.limit("20/minute")
async def select_role(
    request: Request,
    body: SelectRoleRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RegisterResponse:
    """Foydalanuvchi rollari (yo'lovchi/buyurtmachi) o'rtasida erkin almashish.

    Ro'yxatdan o'tish ma'lumoti so'ralmaydi — telefon/ism botda olingan.
    Xodim/admin rollari himoyalangan: ularni bu yerdan o'zgartirib bo'lmaydi.
    """
    if body.role not in SELF_ROLES:
        raise AppError("FORBIDDEN", "Bu rolni tanlab bo'lmaydi", status_code=403)
    if user.role not in SWITCHABLE_ROLES:
        raise AppError("FORBIDDEN", "Rolingizni o'zgartirib bo'lmaydi", status_code=403)

    user.role = body.role
    if body.role == Role.CARRIER and user.carrier_number is None:
        user.carrier_number = await next_value(db, "carrier_number")
    await db.flush()
    await db.refresh(user)

    token = create_access_token(user.id, str(user.role))
    return RegisterResponse(token=token, user=UserOut.model_validate(user, from_attributes=True))


@router.post("/auth/staff-request", response_model=RegisterResponse)
@limiter.limit("5/minute")
async def staff_request(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RegisterResponse:
    """Xodim sifatida kirish so'rovi. Admin tasdiqlagach rol tayinlanadi.

    Foydalanuvchini PENDING holatiga o'tkazadi va admin uchun so'rov yaratadi
    (agar hali kutilayotgan so'rovi bo'lmasa).
    """
    # Xodim/admin allaqachon bo'lsa — qayta so'rovga hojat yo'q
    if user.role not in SWITCHABLE_ROLES:
        raise AppError("FORBIDDEN", "Siz allaqachon xodim sifatida kirgansiz", status_code=403)

    user.role = Role.PENDING
    await db.flush()

    existing = await db.scalar(
        select(StaffRequest).where(
            StaffRequest.user_id == user.id,
            StaffRequest.status == StaffRequestStatus.PENDING,
        )
    )
    if existing is None:
        db.add(StaffRequest(user_id=user.id, status=StaffRequestStatus.PENDING))
        await db.flush()
        await on_staff_request(db, name=f"{user.first_name} {user.last_name}".strip())

    await db.refresh(user)
    token = create_access_token(user.id, str(user.role))
    return RegisterResponse(token=token, user=UserOut.model_validate(user, from_attributes=True))
