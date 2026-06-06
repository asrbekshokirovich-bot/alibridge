import logging

from aiogram import F, Router
from aiogram.filters import CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    Message,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
    WebAppInfo,
)
from sqlalchemy import select

from app.core.config import settings
from app.core.enums import Role
from app.db.base import SessionLocal
from app.db.models import User

logger = logging.getLogger("alibridge.bot")

router = Router()


class Reg(StatesGroup):
    """Soddalashtirilgan ro'yxatdan o'tish: telefon -> ism."""

    phone = State()
    name = State()


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
        keyboard=[[KeyboardButton(text="📱 Telefon raqamni ulashish", request_contact=True)]],
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

    # Yangi foydalanuvchi — telefon so'raymiz
    await state.set_state(Reg.phone)
    await message.answer(
        f"Assalomu alaykum, <b>{tg.first_name}</b>! 👋\n\n"
        "<b>ALI BRIDGE</b> — Xitoy/Turkiya yuk yetkazish tizimi.\n\n"
        "Boshlash uchun telefon raqamingizni ulashing 👇",
        reply_markup=_phone_keyboard(),
    )


@router.message(Reg.phone, F.contact)
async def reg_phone(message: Message, state: FSMContext) -> None:
    contact = message.contact
    # Faqat o'z raqamini ulashishi mumkin (boshqaning kontaktini emas)
    if contact.user_id != message.from_user.id:
        await message.answer(
            "Iltimos, <b>o'zingizning</b> raqamingizni ulashing 👇",
            reply_markup=_phone_keyboard(),
        )
        return

    phone = contact.phone_number
    if not phone.startswith("+"):
        phone = "+" + phone
    await state.update_data(phone=phone)
    await state.set_state(Reg.name)
    await message.answer(
        "Rahmat! Endi <b>ism-familiyangizni</b> yozing:",
        reply_markup=ReplyKeyboardRemove(),
    )


@router.message(Reg.phone)
async def reg_phone_invalid(message: Message) -> None:
    await message.answer(
        "Iltimos, pastdagi <b>📱 Telefon raqamni ulashish</b> tugmasini bosing.",
        reply_markup=_phone_keyboard(),
    )


@router.message(Reg.name, F.text)
async def reg_name(message: Message, state: FSMContext) -> None:
    full_name = message.text.strip()
    if len(full_name) < 2:
        await message.answer("Iltimos, to'liq ismingizni yozing:")
        return

    parts = full_name.split(maxsplit=1)
    first_name = parts[0]
    last_name = parts[1] if len(parts) > 1 else ""

    data = await state.get_data()
    phone = data.get("phone", "")
    await state.clear()

    # Foydalanuvchini yaratamiz — default rol: orderer (Mini App'da almashtira oladi)
    async with SessionLocal() as db:
        existing = await db.scalar(
            select(User).where(User.telegram_id == message.from_user.id)
        )
        if existing is None:
            db.add(
                User(
                    telegram_id=message.from_user.id,
                    first_name=first_name,
                    last_name=last_name,
                    phone=phone,
                    role=Role.NEW,  # rol tanlanmagan — Mini App'da Welcome ko'rsatiladi
                    is_active=True,
                )
            )
            await db.commit()

    await message.answer(
        f"✅ Tayyor, <b>{first_name}</b>!\n\n"
        "Endi ilovani oching va kerakli bo'limni tanlang 👇",
        reply_markup=_miniapp_keyboard(),
    )


@router.message(Reg.name)
async def reg_name_invalid(message: Message) -> None:
    await message.answer("Iltimos, ism-familiyangizni matn ko'rinishida yozing:")


@router.message(F.text == "/app")
async def cmd_app(message: Message) -> None:
    await message.answer("ALI BRIDGE:", reply_markup=_miniapp_keyboard())
