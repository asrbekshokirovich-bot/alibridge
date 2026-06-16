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
        await bot.send_message(telegram_id, text)
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
    text = f"📦 Yangi buyurtma #{order_id}\nYo'lovchi: {carrier_name}\nTasdiqlash kutilmoqda."
    await notify_roles(
        db,
        (Role.WAREHOUSE_UZ, Role.ADMIN, Role.COURIER_UZ, Role.COURIER_TR),
        text,
    )


async def on_order_confirmed(db: AsyncSession, *, carrier_id: int, order_id: int) -> None:
    await notify_user(
        db,
        carrier_id,
        f"✅ Buyurtmangiz #{order_id} tasdiqlandi!\nYukingizni kuting.",
    )


async def on_staff_request(db: AsyncSession, *, name: str) -> None:
    await notify_roles(
        db,
        (Role.ADMIN,),
        f"👤 Yangi xodim so'rovi: {name}\nTasdiqlash uchun panelga kiring.",
    )


async def on_staff_approved(db: AsyncSession, *, user_id: int, role: str) -> None:
    role_names = {
        "warehouse_uz": "Toshkent ombori",
        "warehouse_tr": "Turkiya ombori",
        "courier_uz": "Toshkent kuryeri",
        "courier_tr": "Turkiya kuryeri",
        "china_worker": "Xitoy ishchisi",
    }
    rn = role_names.get(role, role)
    await notify_user(
        db, user_id, f"🎉 Hisobingiz tasdiqlandi!\nRol: {rn}\nEndi tizimga kira olasiz."
    )


async def on_damage_reported(
    db: AsyncSession, *, barcode: str, carrier_number: int | None, note: str
) -> None:
    cn = f" (yo'lovchi #{carrier_number})" if carrier_number else ""
    text = f"⚠️ Shikast qayd etildi{cn}\nBarkod: {barcode}\nIzoh: {note}"
    await notify_roles(db, (Role.ADMIN, Role.WAREHOUSE_TR), text)


async def on_airport_handover_pending(
    db: AsyncSession, *, carrier_id: int, count: int
) -> None:
    """Kuryer aeroportда yo'lovchiga yuk topshirmoqchi — yo'lovchi tasdig'i kutilmoqda."""
    text = (
        f"✈️ Kuryer sizga {count} ta yukni topshirmoqchi.\n"
        "Ilovaga kiring, Turkiyadagi manzilingiz va reys raqamingizni "
        "kiritib, qabulni TASDIQLANG."
    )
    await notify_user(db, carrier_id, text)


async def on_all_arrived(
    db: AsyncSession,
    *,
    barcode: str,
    product_name: str,
    carrier_id: int | None = None,
) -> None:
    """Bir barkod ostidagi BARCHA miqdor Turkiya omboriga yetib bordi."""
    text = (
        f"🎯 Yetib bordi!\n{product_name} ({barcode})\n"
        "Bu mahsulotning barcha miqdori Turkiyaga yetib keldi."
    )
    await notify_roles(db, (Role.ADMIN, Role.WAREHOUSE_TR, Role.WAREHOUSE_UZ), text)
    if carrier_id:
        await notify_user(db, carrier_id, text)
