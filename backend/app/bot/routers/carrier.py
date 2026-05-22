"""Carrier (yo'lovchi) router.

Asosiy oqim:
1. Onboarding (passport + ticket + selfie)
2. Catalog Mini App'da
3. /my_picks — mening pick'larim
4. /landed — qo'ndim deb belgilash
"""

from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import Message

from app.domain.enums import Role

router = Router(name="carrier")


# ============================================
# FSM holatlari (onboarding)
# ============================================
class CarrierOnboarding(StatesGroup):
    waiting_consent = State()
    waiting_phone = State()
    waiting_passport = State()
    waiting_selfie = State()
    waiting_ticket = State()
    confirming_destination = State()
    final_confirm = State()


# ============================================
# Buyruqlar
# ============================================
@router.message(Command("become_carrier"))
async def start_onboarding(message: Message, state: FSMContext) -> None:
    """Carrier sifatida ro'yxatdan o'tishni boshlash."""
    await state.set_state(CarrierOnboarding.waiting_consent)
    await message.answer(
        "🚀 <b>Yo'lovchi (Carrier) ro'yxatdan o'tish</b>\n\n"
        "Sizdan quyidagilar kerak bo'ladi:\n"
        "• Telefon raqami (OTP tasdiqlash)\n"
        "• Passport bio-page rasmi\n"
        "• Selfie\n"
        "• Aviabilet rasmi\n\n"
        "<b>Mas'uliyat:</b> Yo'qotilgan yoki shikastlangan mahsulotlar uchun "
        "to'lovingizdan summa ushlab qolinishi mumkin.\n\n"
        "Davom etish uchun /agree yuboring.",
    )


@router.message(Command("agree"))
async def agree_terms(message: Message, state: FSMContext) -> None:
    """Shartlarga rozilik."""
    current_state = await state.get_state()
    if current_state != CarrierOnboarding.waiting_consent.state:
        return

    await state.set_state(CarrierOnboarding.waiting_phone)
    await message.answer("📱 Telefon raqamingizni yuboring (998XXXXXXXXX formatda)")


@router.message(Command("my_picks"))
async def my_picks(message: Message, roles: list[Role]) -> None:
    """Mening pick'larim."""
    if Role.CARRIER not in roles:
        await message.answer("⛔ Siz carrier emassiz. /become_carrier ni bosing")
        return

    await message.answer("📦 Pick'laringiz Mini App'da ko'rinadi")


@router.message(Command("landed"))
async def report_landed(message: Message, roles: list[Role]) -> None:
    """Qo'ndim deb belgilash."""
    if Role.CARRIER not in roles:
        return

    await message.answer(
        "✅ Qo'nganingiz qabul qilindi!\n\n"
        "Endi Turkiyadagi manzilingizni Mini App'dan kiriting."
    )
