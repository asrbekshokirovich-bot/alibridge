"""Dev seed — test ma'lumotlari. Ishga tushirish:
    docker compose exec backend python -m app.seed
"""
import asyncio
from datetime import date
from decimal import Decimal

from sqlalchemy import select

from app.core.enums import ProductStatus, ProductType, Role
from app.db.base import SessionLocal
from app.db.models import Counter, Product, User


async def seed() -> None:
    async with SessionLocal() as db:
        # Test xodimlar (har rol uchun bittadan) — dev login bilan mos telegram_id
        staff = [
            (900001, "Aziz", "Karimov", Role.WAREHOUSE_UZ),
            (900002, "Dilshod", "Rahimov", Role.COURIER_UZ),
            (900003, "Murod", "Tursunov", Role.COURIER_TR),
            (900004, "Kamol", "Yusupov", Role.WAREHOUSE_TR),
            (900005, "Admin", "Bosh", Role.ADMIN),
        ]
        for tg_id, fn, ln, role in staff:
            exists = await db.scalar(select(User).where(User.telegram_id == tg_id))
            if not exists:
                db.add(
                    User(
                        telegram_id=tg_id,
                        first_name=fn,
                        last_name=ln,
                        phone="+998900000000",
                        role=role,
                        is_active=True,
                    )
                )

        # Test mahsulotlar (katalog uchun)
        sample = [
            ("Krasovka Nike", "Poyabzal", ProductType.PIECE, 600, Decimal("480"),
             Decimal("0.8"), None, Decimal("50000")),
            ("iPhone 15 Case", "Aksessuar", ProductType.PIECE, 200, Decimal("20"),
             Decimal("0.1"), None, Decimal("15000")),
            ("Tekstil mato", "Tekstil", ProductType.WEIGHT, 0, Decimal("100"),
             None, Decimal("2"), Decimal("30000")),
            ("Parfyumeriya", "Kosmetika", ProductType.PIECE, 150, Decimal("75"),
             Decimal("0.5"), None, Decimal("40000")),
        ]
        existing_count = await db.scalar(select(Counter).where(Counter.name == "barcode"))
        for name, cat, ptype, qty, wkg, uw, bw, price in sample:
            exists = await db.scalar(select(Product).where(Product.name == name))
            if exists:
                continue
            # barcode generatsiya (seed uchun sodda)
            from app.services.counter_service import next_value

            num = await next_value(db, "barcode")
            db.add(
                Product(
                    barcode=f"ALB-{num}",
                    name=name,
                    category=cat,
                    type=ptype,
                    quantity=qty,
                    weight_kg=wkg,
                    unit_weight_kg=uw,
                    box_weight_kg=bw,
                    cargo_price=price,
                    status=ProductStatus.IN_WAREHOUSE_UZ,
                    received_date=date.today(),
                )
            )

        await db.commit()
        print("Seed tugadi.")


if __name__ == "__main__":
    asyncio.run(seed())
