"""Auth endpoint — Telegram initData → JWT."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.api.deps.db import get_db_session
from app.core.exceptions import AppException
from app.core.limiter import limiter
from app.core.security import create_access_token
from app.domain.enums import Role
from app.infra.db.models.user import User
from app.infra.telegram.auth import validate_init_data
from app.repositories.user_repo import UserRepository

router = APIRouter()


class TelegramAuthRequest(BaseModel):
    init_data: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    user_id: str
    roles: list[str]
    language_code: str


@router.post("/telegram", response_model=AuthResponse)
@limiter.limit("10/minute")
async def auth_telegram(
    request: Request,
    body: TelegramAuthRequest,
    session: AsyncSession = Depends(get_db_session),
) -> AuthResponse:
    """Telegram Mini App auth.

    Mini App ochilganda, frontend `Telegram.WebApp.initData` ni shu endpoint'ga yuboradi.
    Backend imzoni tekshiradi, foydalanuvchini yaratadi/topadi va JWT qaytaradi.
    """
    # 1. Telegram imzosini tekshirish
    init = validate_init_data(body.init_data)
    tg_user = init.get("user", {})

    if not tg_user.get("id"):
        from app.core.exceptions import TelegramAuthError

        raise TelegramAuthError(message="initData'da user yo'q")

    # 2. User upsert
    repo = UserRepository(session)
    user = await repo.upsert_telegram_user(
        telegram_id=tg_user["id"],
        full_name=(
            f"{tg_user.get('first_name', '')} {tg_user.get('last_name', '')}".strip()
            or None
        ),
        telegram_username=tg_user.get("username"),
        language_code=tg_user.get("language_code", "uz")[:2],
    )
    roles = await repo.get_roles(user.id)

    # 3. JWT yaratish
    from app.core.config import settings

    token = create_access_token(
        user_id=user.id,
        roles=[r.value for r in roles],
    )

    return AuthResponse(
        access_token=token,
        expires_in=settings.jwt_expire_minutes * 60,
        user_id=str(user.id),
        roles=[r.value for r in roles],
        language_code=user.language_code,
    )


# ============================================
# Foydalanuvchi o'zi uchun rol tanlaydi
# ============================================

# Faqat shu ikki rol o'z-o'zidan tanlanishi mumkin
_SELF_ASSIGNABLE: frozenset[Role] = frozenset({Role.ORDERER, Role.CARRIER})


class SelectRoleRequest(BaseModel):
    role: str  # "orderer" | "carrier"


@router.post("/select-role", response_model=AuthResponse)
async def select_role(
    body: SelectRoleRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AuthResponse:
    """Yangi foydalanuvchi o'zi uchun rol tanlaydi.

    Faqat 'orderer' va 'carrier' rollari o'z-o'zidan tanlanishi mumkin.
    Boshqa rollar (warehouse, courier, admin) faqat admin tomonidan beriladi.
    """
    # Rol validatsiyasi
    try:
        selected = Role(body.role)
    except ValueError:
        raise AppException(
            message=f"Noto'g'ri rol: {body.role}",
            error_code="invalid_role",
            details={"allowed": [r.value for r in _SELF_ASSIGNABLE]},
        )

    if selected not in _SELF_ASSIGNABLE:
        raise AppException(
            message="Bu rolni o'zingiz tanlay olmaysiz. Admin bilan bog'laning.",
            error_code="role_not_self_assignable",
            details={"self_assignable": [r.value for r in _SELF_ASSIGNABLE]},
        )

    repo = UserRepository(session)

    # Allaqachon roli bormi?
    existing = await repo.get_roles(current_user.id)
    if existing:
        raise AppException(
            message="Sizda allaqachon rol bor",
            error_code="role_already_assigned",
            details={"current_roles": [r.value for r in existing]},
        )

    # Rol berish (o'zi o'ziga beradi)
    await repo.grant_role(
        user_id=current_user.id,
        role=selected,
        granted_by_user_id=current_user.id,
    )
    await session.commit()

    # Yangi JWT — rol bilan
    roles = await repo.get_roles(current_user.id)

    from app.core.config import settings

    token = create_access_token(
        user_id=current_user.id,
        roles=[r.value for r in roles],
    )

    return AuthResponse(
        access_token=token,
        expires_in=settings.jwt_expire_minutes * 60,
        user_id=str(current_user.id),
        roles=[r.value for r in roles],
        language_code=current_user.language_code,
    )
