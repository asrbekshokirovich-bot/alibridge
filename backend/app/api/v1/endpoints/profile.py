"""User profile endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.api.deps.db import get_db_session
from app.domain.entities.user import UserEntity
from app.infra.db.models.user import User
from app.repositories.user_repo import UserRepository

router = APIRouter()


class ProfileResponse(BaseModel):
    user: UserEntity
    roles: list[str]


@router.get("/me", response_model=ProfileResponse)
async def get_my_profile(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ProfileResponse:
    """Mening profilim."""
    repo = UserRepository(session)
    roles = await repo.get_roles(user.id)

    return ProfileResponse(
        user=UserEntity.model_validate(user),
        roles=[r.value for r in roles],
    )


class UpdateLanguageRequest(BaseModel):
    language_code: str


@router.patch("/me/language")
async def update_language(
    body: UpdateLanguageRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Til o'zgartirish."""
    if body.language_code not in {"uz", "ru", "tr", "en"}:
        from app.core.exceptions import ValidationError

        raise ValidationError(message="Til qo'llanmaydi")

    user.language_code = body.language_code
    await session.flush()
    return {"language_code": body.language_code}
