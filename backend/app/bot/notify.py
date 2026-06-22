"""Bot bildirishnomalari. Xatolar yutiladi — bildirishnoma asosiy oqimni buzmasligi kerak."""

import logging

from aiogram.exceptions import TelegramAPIError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.bot.instance import get_bot
from app.core.enums import Role
from app.db.models import User

logger = logging.getLogger("alibridge.notify")


async def _send(telegram_id: int, text: str) -> None:
    try:
        bot = get_bot()
        await bot.send_message(telegram_id, text, parse_mode="HTML")
    except TelegramAPIError as e:
        logger.warning("Bildirishnoma yuborilmadi (tg=%s): %s", telegram_id, e)
    except Exception as e:  # noqa: BLE001
        logger.warning("Bildirishnoma xatosi (tg=%s): %s", telegram_id, e)


async def _telegram_ids_by_role(db: AsyncSession, *roles: Role) -> list[int]:
    rows = await db.execute(
        select(User.telegram_id).where(User.role.in_(roles), User.is_active.is_(True))
    )
    return [r[0] for r in rows.all()]


async def notify_roles(db: AsyncSession, roles: tuple[Role, ...], text: str) -> None:
    for tg_id in await _telegram_ids_by_role(db, *roles):
        await _send(tg_id, text)


async def notify_user(db: AsyncSession, user_id: int, text: str) -> None:
    user = await db.get(User, user_id)
    if user:
        await _send(user.telegram_id, text)


# ─── Hodisa-asosli bildirishnomalar ─────────────────────────────────────────────


async def on_new_order(db: AsyncSession, *, carrier_name: str, order_id: int) -> None:
    text = (
        f"📦 <b>Yangi buyurtma #{order_id}</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 Yo'lovchi: <b>{carrier_name}</b>\n"
        "⏳ Holat: Tasdiqlash kutilmoqda\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "Panelga kirib tasdiqlang 👉 /app"
    )
    await notify_roles(
        db,
        (Role.WAREHOUSE_UZ, Role.ADMIN, Role.COURIER_UZ, Role.COURIER_TR),
        text,
    )


async def on_order_confirmed(db: AsyncSession, *, carrier_id: int, order_id: int) -> None:
    text = (
        f"✅ <b>Buyurtma #{order_id} tasdiqlandi!</b>\n\n"
        "Yukingiz omborga qabul qilindi.\n"
        "Holat yangilanishlarini kuzatish uchun ilovani oching 👉 /app"
    )
    await notify_user(db, carrier_id, text)


async def on_staff_request(db: AsyncSession, *, name: str) -> None:
    text = (
        "👤 <b>Yangi xodim so'rovi</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        f"Ism: <b>{name}</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "Tasdiqlash uchun admin panelga kiring 👉 /app"
    )
    await notify_roles(db, (Role.ADMIN,), text)


async def on_staff_approved(db: AsyncSession, *, user_id: int, role: str) -> None:
    role_names = {
        "warehouse_uz": "🏭 Toshkent ombori",
        "warehouse_tr": "🏬 Turkiya ombori",
        "courier_uz": "🚚 Toshkent kuryeri",
        "courier_tr": "🛵 Turkiya kuryeri",
        "china_worker": "🇨🇳 Xitoy ishchisi",
    }
    rn = role_names.get(role, role)
    text = (
        "🎉 <b>Hisobingiz tasdiqlandi!</b>\n\n"
        f"Tayinlangan rol: {rn}\n\n"
        "Endi tizimga kirishingiz mumkin 👉 /app"
    )
    await notify_user(db, user_id, text)


async def on_damage_reported(
    db: AsyncSession, *, barcode: str, carrier_number: int | None, note: str
) -> None:
    cn = f"\n👤 Yo'lovchi: <b>#{carrier_number}</b>" if carrier_number else ""
    text = (
        "⚠️ <b>Shikast qayd etildi!</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        f"📋 Barkod: <code>{barcode}</code>{cn}\n"
        f"📝 Izoh: {note}\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "Batafsil: /app"
    )
    await notify_roles(db, (Role.ADMIN, Role.WAREHOUSE_TR, Role.WAREHOUSE_UZ), text)


async def on_airport_handover_pending(db: AsyncSession, *, carrier_id: int, count: int) -> None:
    text = (
        f"✈️ <b>Yuk topshirish kutilmoqda</b>\n\n"
        f"Kuryer sizga <b>{count} ta yuk</b> topshirmoqchi.\n\n"
        "📋 Qilish kerak:\n"
        "• Ilovaga kiring\n"
        "• Turkiyadagi manzilingizni kiriting\n"
        "• Reys raqamingizni kiriting\n"
        "• Qabulni <b>TASDIQLANG</b>\n\n"
        "👉 /app"
    )
    await notify_user(db, carrier_id, text)


async def on_all_arrived(
    db: AsyncSession,
    *,
    barcode: str,
    product_name: str,
    carrier_id: int | None = None,
) -> None:
    text = (
        "🎯 <b>Turkiyaga yetib keldi!</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        f"📦 Mahsulot: <b>{product_name}</b>\n"
        f"📋 Barkod: <code>{barcode}</code>\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "Barcha miqdor Turkiya omboriga yetib keldi ✅"
    )
    await notify_roles(db, (Role.ADMIN, Role.WAREHOUSE_TR, Role.WAREHOUSE_UZ), text)
    if carrier_id:
        await notify_user(db, carrier_id, text)
