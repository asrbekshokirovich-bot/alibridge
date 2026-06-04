"""Auth dependency — JWT'dan foydalanuvchi va rollarni olish."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, Header, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.db import get_db_session
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_access_token
from app.domain.enums import Role
from app.infra.db.models.user import User
from app.repositories.user_repo import UserRepository


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    token: str | None = Query(default=None, description="JWT (fayl yuklash uchun query param)"),
    session: AsyncSession = Depends(get_db_session),
) -> User:
    """JWT'dan foydalanuvchini olish.

    Authorization: Bearer <token> header'i yoki ?token= query param kutiladi.
    """
    jwt_token: str | None = None
    via_query = False
    if authorization and authorization.startswith("Bearer "):
        jwt_token = authorization.removeprefix("Bearer ")
    elif token:
        jwt_token = token
        via_query = True

    if not jwt_token:
        raise UnauthorizedError(message="Authorization header yo'q")

    payload = decode_access_token(jwt_token)

    # H1: URL query orqali kelgan token faqat qisqa muddatli "download" tokeni
    # bo'lishi mumkin. Oddiy sessiya tokenini URL'da ishlatib bo'lmaydi
    # (access loglarda uzoq muddat qoladi).
    if via_query and payload.get("scope") != "download":
        raise UnauthorizedError(message="Bu token URL orqali ishlatib bo'lmaydi")

    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError) as e:
        raise UnauthorizedError(message="Token yaroqsiz (sub yo'q)") from e

    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)
    if user is None:
        raise UnauthorizedError(message="Foydalanuvchi topilmadi")

    return user


def require_role(*allowed_roles: Role):
    """Faqat ma'lum rollar uchun endpoint himoyasi.

    Foydalanish:
        @router.get("/admin/users", dependencies=[Depends(require_role(Role.ADMIN))])
        async def list_users(): ...
    """
    async def _check(
        user: User = Depends(get_current_user),
        session: AsyncSession = Depends(get_db_session),
    ) -> User:
        repo = UserRepository(session)
        user_roles = await repo.get_roles(user.id)

        if not any(r in allowed_roles for r in user_roles):
            raise ForbiddenError(
                message=f"Ushbu amal uchun {[r.value for r in allowed_roles]} rolingiz kerak"
            )

        return user

    return _check
