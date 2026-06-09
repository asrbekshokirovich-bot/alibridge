import logging

from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    Message,
    ReplyKeyboardMarkup,
    WebAppInfo,
)
from sqlalchemy import select

from app.core.config import settings
from app.core.enums import Role, StaffRequestStatus
from app.db.base import SessionLocal
from app.db.models import StaffRequest, User

logger = logging.getLogger("alibridge.bot")

router = Router()


class Reg(StatesGroup):
    """Ro'yxatdan o'tish: faqat telefon (ism Telegram'dan avtomatik)."""

    phone = State()


def _miniapp_keyboard() -> InlineKeyboardMarkup:
    url = settings.miniapp_url or "https://example.com"
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🚀 ALI BRIDGE'ni ochish",
                    web_app=WebAppInfo(url=url),
                )
            ]
        ]
    )


def _phone_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="✅ Ro'yxatdan o'tish", request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
        input_field_placeholder="Pastdagi tugmani bosing",
    )


async def _get_user(telegram_id: int) -> User | None:
    async with SessionLocal() as db:
        return await db.scalar(select(User).where(User.telegram_id == telegram_id))


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext) -> None:
    if not message.from_user:
        return
    tg = message.from_user
    logger.info(
        "START bosildi: telegram_id=%s name=%s username=@%s",
        tg.id,
        tg.first_name,
        tg.username,
    )

    # Allaqachon ro'yxatdan o'tgan bo'lsa — to'g'ridan-to'g'ri Mini App
    user = await _get_user(tg.id)
    if user is not None:
        await state.clear()
        await message.answer(
            f"Assalomu alaykum, <b>{user.first_name}</b>! 👋\n\n"
            "Davom etish uchun pastdagi tugmani bosing:",
            reply_markup=_miniapp_keyboard(),
        )
        return

    # Yangi foydalanuvchi — ro'yxatdan o'tish (telefon + ism avtomatik olinadi)
    await state.set_state(Reg.phone)
    await message.answer(
        f"Assalomu alaykum, <b>{tg.first_name}</b>! 👋\n\n"
        "<b>ALI BRIDGE</b> — Xitoy/Turkiya yuk yetkazish tizimi.\n\n"
        "Boshlash uchun pastdagi tugmani bosing 👇",
        reply_markup=_phone_keyboard(),
    )


@router.message(Reg.phone, F.contact)
async def reg_phone(message: Message, state: FSMContext) -> None:
    contact = message.contact
    tg = message.from_user
    # Faqat o'z raqamini ulashishi mumkin (boshqaning kontaktini emas)
    if contact.user_id != tg.id:
        await message.answer(
            "Iltimos, <b>o'zingizning</b> raqamingizni ulashing 👇",
            reply_markup=_phone_keyboard(),
        )
        return

    phone = contact.phone_number
    if not phone.startswith("+"):
        phone = "+" + phone

    # Ism Telegram profilidan avtomatik olinadi
    first_name = tg.first_name or ""
    last_name = tg.last_name or ""
    await state.clear()

    # Foydalanuvchini yaratamiz — rol tanlanmagan (NEW). Mini App'da Welcome ko'rsatiladi.
    async with SessionLocal() as db:
        existing = await db.scalar(select(User).where(User.telegram_id == tg.id))
        if existing is None:
            db.add(
                User(
                    telegram_id=tg.id,
                    first_name=first_name,
                    last_name=last_name,
                    phone=phone,
                    role=Role.NEW,
                    is_active=True,
                )
            )
            await db.commit()

    await message.answer(
        f"🎉 <b>Tabriklaymiz, {first_name}!</b>\n\n"
        "Siz muvaffaqiyatli ro'yxatdan o'tdingiz. ✅\n\n"
        "Endi <b>ALI BRIDGE</b> ilovasini ochib, kerakli bo'limni tanlashingiz mumkin 👇",
        reply_markup=_miniapp_keyboard(),
    )


@router.message(Reg.phone)
async def reg_phone_invalid(message: Message) -> None:
    await message.answer(
        "Iltimos, pastdagi <b>✅ Ro'yxatdan o'tish</b> tugmasini bosing.",
        reply_markup=_phone_keyboard(),
    )


@router.message(F.text == "/app")
async def cmd_app(message: Message) -> None:
    await message.answer("ALI BRIDGE:", reply_markup=_miniapp_keyboard())


@router.message(Command("ishchi"))
async def cmd_ishchi(message: Message) -> None:
    """Foydalanuvchi /ishchi yozsa — xodim so'rovi yuboriladi, admin xabar oladi."""
    if not message.from_user:
        return
    tg = message.from_user

    async with SessionLocal() as db:
        user = await db.scalar(select(User).where(User.telegram_id == tg.id))

        # Ro'yxatdan o'tmagan — avval /start bossin
        if user is None:
            await message.answer(
                "Avval ro'yxatdan o'ting — /start ni bosing."
            )
            return

        # Allaqachon xodim yoki admin
        staff_roles = {Role.WAREHOUSE_UZ, Role.WAREHOUSE_TR, Role.COURIER_UZ, Role.COURIER_TR, Role.ADMIN}
        if user.role in staff_roles:
            await message.answer("Siz allaqachon xodim sifatida tizimda ro'yxatdansiz.")
            return

        # Kutilayotgan so'rov bormi
        existing = await db.scalar(
            select(StaffRequest).where(
                StaffRequest.user_id == user.id,
                StaffRequest.status == StaffRequestStatus.PENDING,
            )
        )
        if existing is not None:
            await message.answer("So'rovingiz allaqachon yuborilgan. Admin ko'rib chiqadi.")
            return

        # So'rov yaratamiz
        user.role = Role.PENDING
        db.add(StaffRequest(user_id=user.id, status=StaffRequestStatus.PENDING))
        await db.commit()

    # Foydalanuvchiga tasdiqlash
    await message.answer(
        "✅ <b>So'rov yuborildi!</b>\n\nAdmin tasdiqlashini kuting. Tez orada rol tayinlanadi.",
        parse_mode="HTML",
    )

    # Adminlarga xabar
    from app.bot.notify import on_staff_request
    async with SessionLocal() as db:
        await on_staff_request(db, name=f"{tg.first_name} {tg.last_name or ''}".strip())
