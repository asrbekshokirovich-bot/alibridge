from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import RegType, Role, StaffRequestStatus
from app.db.models import StaffRequest, User
from app.services.counter_service import next_value


async def register_user(
    db: AsyncSession,
    *,
    telegram_id: int,
    first_name: str,
    last_name: str,
    phone: str,
    passport: str | None,
    reg_type: RegType,
) -> tuple[User, bool]:
    """Foydalanuvchini ro'yxatdan o'tkazadi yoki mavjudini qaytaradi.

    Qaytaradi: (user, is_new)
    """
    if reg_type == RegType.CARRIER:
        role = Role.CARRIER
    elif reg_type == RegType.ORDERER:
        role = Role.ORDERER
    else:  # STAFF
        role = Role.PENDING

    # Foydalanuvchi o'zi erkin tanlay oladigan rollar (xodim emas)
    SELF_ROLES = {Role.PENDING, Role.CARRIER, Role.ORDERER}

    existing = await db.scalar(select(User).where(User.telegram_id == telegram_id))
    if existing is not None:
        # Allaqachon ro'yxatdan o'tgan.
        # Foydalanuvchi rollari (pending/carrier/orderer) o'rtasida erkin almashish
        # mumkin. Xodim rollari (warehouse/courier/admin) himoyalangan — o'zgarmaydi.
        if existing.role in SELF_ROLES and reg_type in (RegType.CARRIER, RegType.ORDERER):
            existing.role = role
            existing.first_name = first_name or existing.first_name
            existing.last_name = last_name or existing.last_name
            existing.phone = phone or existing.phone
            existing.passport = passport or existing.passport
            if reg_type == RegType.CARRIER and existing.carrier_number is None:
                existing.carrier_number = await next_value(db, "carrier_number")
            await db.flush()
            await db.refresh(existing)
        # mavjud hisobni qaytaramiz (qayta login)
        return existing, False

    user = User(
        telegram_id=telegram_id,
        first_name=first_name,
        last_name=last_name,
        phone=phone,
        passport=passport,
        role=role,
        is_active=True,
    )

    if reg_type == RegType.CARRIER:
        user.carrier_number = await next_value(db, "carrier_number")

    db.add(user)
    await db.flush()

    # Xodim bo'lsa — admin tasdig'i uchun so'rov yaratamiz
    if reg_type == RegType.STAFF:
        db.add(StaffRequest(user_id=user.id, status=StaffRequestStatus.PENDING))
        await db.flush()

    await db.refresh(user)
    return user, True
