"""Admin router — boshqaruv operatsiyalari."""

from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

from app.domain.enums import Role

router = Router(name="admin")

_VALID_ROLES = {r.value for r in Role}


@router.message(Command("admin"))
async def admin_panel(message: Message, roles: list[Role]) -> None:
    """Admin paneli."""
    if Role.ADMIN not in roles:
        await message.answer("⛔ Faqat admin uchun")
        return

    await message.answer(
        "👤 <b>Admin Panel</b>\n\n"
        "Barcha funksiyalar Mini App'da:\n"
        "• Foydalanuvchilarga rol berish\n"
        "• Buyurtmalarni ko'rib chiqish\n"
        "• Payout'larni tasdiqlash\n"
        "• Dispute'larni hal qilish\n"
        "• Statistika\n\n"
        "<b>Bot komandalar:</b>\n"
        "/grant &lt;telegram_id&gt; &lt;rol&gt; — rol berish\n"
        "/revoke &lt;telegram_id&gt; &lt;rol&gt; — rolni olish",
        parse_mode="HTML",
    )


@router.message(Command("grant"))
async def grant_role(message: Message, roles: list[Role], db_user) -> None:
    """Foydalanuvchiga rol berish.

    Format: /grant <telegram_id> <role>
    Misol:  /grant 123456789 warehouse_uz
    """
    if Role.ADMIN not in roles:
        return

    parts = (message.text or "").strip().split()
    if len(parts) != 3:
        await message.answer(
            "❌ Format: /grant &lt;telegram_id&gt; &lt;rol&gt;\n\n"
            f"Mavjud rollar:\n{', '.join(sorted(_VALID_ROLES))}",
            parse_mode="HTML",
        )
        return

    _, raw_tg_id, raw_role = parts

    if not raw_tg_id.lstrip("-").isdigit():
        await message.answer("❌ telegram_id raqam bo'lishi kerak")
        return

    if raw_role not in _VALID_ROLES:
        await message.answer(
            f"❌ Noto'g'ri rol: <code>{raw_role}</code>\n\n"
            f"Mavjud rollar: {', '.join(sorted(_VALID_ROLES))}",
            parse_mode="HTML",
        )
        return

    target_tg_id = int(raw_tg_id)
    role = Role(raw_role)

    from app.infra.db.session import AsyncSessionLocal
    from app.repositories.user_repo import UserRepository

    async with AsyncSessionLocal() as session:
        repo = UserRepository(session)
        target_user = await repo.get_by_telegram_id(target_tg_id)
        if not target_user:
            await message.answer(f"❌ Telegram ID {target_tg_id} topilmadi")
            return

        await repo.grant_role(
            user_id=target_user.id,
            role=role,
            granted_by_user_id=db_user.id,
        )
        await session.commit()

    # L3: rol darhol kuchga kirsin (cache tozalash)
    from app.infra.cache.redis_client import invalidate_bot_auth_cache
    await invalidate_bot_auth_cache(target_tg_id)

    await message.answer(
        f"✅ <b>{target_user.full_name or target_tg_id}</b> ga "
        f"<code>{raw_role}</code> roli berildi.",
        parse_mode="HTML",
    )


@router.message(Command("revoke"))
async def revoke_role(message: Message, roles: list[Role]) -> None:
    """Foydalanuvchidan rolni olib tashlash.

    Format: /revoke <telegram_id> <role>
    """
    if Role.ADMIN not in roles:
        return

    parts = (message.text or "").strip().split()
    if len(parts) != 3:
        await message.answer("❌ Format: /revoke &lt;telegram_id&gt; &lt;rol&gt;", parse_mode="HTML")
        return

    _, raw_tg_id, raw_role = parts

    if not raw_tg_id.lstrip("-").isdigit():
        await message.answer("❌ telegram_id raqam bo'lishi kerak")
        return

    target_tg_id = int(raw_tg_id)

    from app.infra.db.session import AsyncSessionLocal
    from app.repositories.user_repo import UserRepository

    async with AsyncSessionLocal() as session:
        repo = UserRepository(session)
        target_user = await repo.get_by_telegram_id(target_tg_id)
        if not target_user:
            await message.answer(f"❌ Telegram ID {target_tg_id} topilmadi")
            return

        removed = await repo.revoke_role(user_id=target_user.id, role=raw_role)
        await session.commit()

    # L3: rol darhol olinsin (cache tozalash)
    from app.infra.cache.redis_client import invalidate_bot_auth_cache
    await invalidate_bot_auth_cache(target_tg_id)

    if removed:
        await message.answer(
            f"✅ <b>{target_user.full_name or target_tg_id}</b> dan "
            f"<code>{raw_role}</code> roli olindi.",
            parse_mode="HTML",
        )
    else:
        await message.answer(f"⚠️ Bu foydalanuvchida <code>{raw_role}</code> roli yo'q edi.", parse_mode="HTML")
