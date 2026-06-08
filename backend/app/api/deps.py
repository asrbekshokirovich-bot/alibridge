from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import Role
from app.core.errors import AppError
from app.core.security import decode_access_token
from app.db.base import get_db
from app.db.models import User

__all__ = ["get_db", "get_current_user", "require_role", "AsyncSession"]


async def get_current_user(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AppError("UNAUTHORIZED", "Avtorizatsiya talab qilinadi", status_code=401)

    token = authorization.split(" ", 1)[1].strip()
    payload = decode_access_token(token)
    user_id = int(payload["sub"])

    user = await db.get(User, user_id)
    if user is None:
        raise AppError("UNAUTHORIZED", "Foydalanuvchi topilmadi", status_code=401)
    if not user.is_active:
        raise AppError("FORBIDDEN", "Hisob faol emas", status_code=403)
    return user


def require_role(*roles: Role):
    """Berilgan rollardan biriga ega foydalanuvchini talab qiladi.
    Admin har doim ruxsatga ega."""

    allowed = set(roles)

    async def _dep(user: User = Depends(get_current_user)) -> User:
        if user.role == Role.ADMIN:
            return user
        if user.role not in allowed:
            raise AppError(
                "FORBIDDEN",
                "Bu amal uchun ruxsat yo'q",
                status_code=403,
                details={"required": [r.value for r in roles]},
            )
        return user

    return _dep
