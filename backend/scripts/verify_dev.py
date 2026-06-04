"""Dev verifikatsiya harness — faqat development.

Container ichida ishlaydi (jwt_secret va deps mos keladi):
    docker compose exec -T backend python scripts/verify_dev.py

8 rol uchun foydalanuvchi seed qiladi, JWT mint qiladi va asosiy
oqimlarni httpx orqali end-to-end assert qiladi. Hech qaysi prod kodga
ulanmaydi; qayta ishga tushirish idempotent (upsert + grant_role).
"""

from __future__ import annotations

import asyncio
import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

# /app ni sys.path ga qo'shish (import app ... ishlashi uchun)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx  # noqa: E402

from app.core.security import create_access_token  # noqa: E402
from app.domain.enums import OnboardingChannel, Role  # noqa: E402
from app.infra.db.models.carrier import CarrierProfile  # noqa: E402
from app.infra.db.session import AsyncSessionLocal  # noqa: E402
from app.repositories.user_repo import UserRepository  # noqa: E402

BASE = "http://localhost:8000/api/v1"
TG_BASE = 9_900_000_000

ROLES = [
    Role.ORDERER,
    Role.CHINA_WORKER,
    Role.WAREHOUSE_UZ,
    Role.WAREHOUSE_TR,
    Role.CARRIER,
    Role.COURIER_UZ,
    Role.COURIER_TR,
    Role.ADMIN,
]

_results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, resp: httpx.Response | None = None, extra: str = "") -> None:
    detail = extra
    if resp is not None and not ok:
        body = resp.text[:200].replace("\n", " ")
        detail = f"HTTP {resp.status_code} :: {body}"
    _results.append((name, ok, detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  — {detail}" if detail and not ok else ""))


async def seed_tokens() -> tuple[dict[str, str], dict]:
    tokens: dict[str, str] = {}
    ids: dict = {}
    async with AsyncSessionLocal() as s:
        repo = UserRepository(s)
        for i, role in enumerate(ROLES):
            user = await repo.upsert_telegram_user(
                telegram_id=TG_BASE + i,
                full_name=f"Verify {role.value}",
                telegram_username=f"verify_{role.value}",
                language_code="uz",
            )
            await s.flush()
            await repo.grant_role(
                user_id=user.id, role=role, granted_by_user_id=user.id
            )
            tokens[role.value] = create_access_token(
                user_id=user.id, roles=[role.value]
            )
            ids[role.value] = user.id

        # Carrier uchun minimal profil — basket FK carrier_profiles.user_id ga bog'liq
        carrier_id = ids["carrier"]
        if not await s.get(CarrierProfile, carrier_id):
            s.add(
                CarrierProfile(
                    user_id=carrier_id,
                    depart_airport_iata="TAS",
                    arrive_airport_iata="IST",
                    depart_at=datetime.now(timezone.utc),
                    allowed_kg=Decimal("20"),
                    liability_consented_at=datetime.now(timezone.utc),
                    onboarding_channel=OnboardingChannel.SELF_SERVE.value,
                )
            )

        # Idempotentlik: test carrier'ning oldingi run'dagi picks'larini
        # tozalash — savat ham carrier_picks (handoff_status=IN_BASKET).
        # Aks holda uq_one_carrier_per_product qayta-run'da buziladi.
        from sqlalchemy import text

        await s.execute(
            text("DELETE FROM carrier_picks WHERE carrier_user_id = :cid"),
            {"cid": carrier_id},
        )
        await s.commit()
    return tokens, ids


def hdr(tok: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {tok}"}


async def run_checks(tokens: dict[str, str], ids: dict) -> None:
    async with httpx.AsyncClient(timeout=30.0) as c:
        # ── WH approval oqimi (asosiy) ──────────────────────────────────
        r = await c.post(
            f"{BASE}/orders/simple",
            headers=hdr(tokens["orderer"]),
            json={
                "destination_city": "Verify shahar",
                "lines": [{"name": "Verify mahsulot", "quantity": 2, "unit_weight_g": 500}],
            },
        )
        ok_create = r.status_code == 201 and "id" in (r.json() if r.status_code == 201 else {})
        check("orderer create order (/orders/simple 201)", ok_create, r)
        order_id = r.json().get("id") if ok_create else None

        if order_id:
            r = await c.get(
                f"{BASE}/warehouse/uz/pending-approvals", headers=hdr(tokens["warehouse_uz"])
            )
            appr_ids = [o["id"] for o in r.json()] if r.status_code == 200 else []
            check("wh sees order in pending-approvals", r.status_code == 200 and order_id in appr_ids, r)

            r = await c.post(
                f"{BASE}/warehouse/uz/orders/{order_id}/approve",
                headers=hdr(tokens["warehouse_uz"]),
            )
            check("wh approve order (200)", r.status_code == 200, r)

            r = await c.post(
                f"{BASE}/warehouse/uz/orders/{order_id}/approve",
                headers=hdr(tokens["warehouse_uz"]),
            )
            check("wh re-approve rejected (409)", r.status_code == 409, r)

            r = await c.get(f"{BASE}/orders", headers=hdr(tokens["orderer"]))
            found = next((o for o in r.json() if o["id"] == order_id), None) if r.status_code == 200 else None
            check(
                "orderer sees wh_uz_approved_at set",
                found is not None and bool(found.get("wh_uz_approved_at")),
                r,
            )

        # ── Debts ───────────────────────────────────────────────────────
        r = await c.get(f"{BASE}/admin/debts?status=all", headers=hdr(tokens["admin"]))
        check("admin debts list (200)", r.status_code == 200, r)
        r = await c.get(f"{BASE}/carrier/debts", headers=hdr(tokens["carrier"]))
        check("carrier debts (200)", r.status_code == 200, r)

        # ── Courier history ─────────────────────────────────────────────
        r = await c.get(f"{BASE}/courier/history", headers=hdr(tokens["courier_uz"]))
        check("courier history (200)", r.status_code == 200, r)

        # ── China ───────────────────────────────────────────────────────
        r = await c.get(f"{BASE}/china/tickets", headers=hdr(tokens["china_worker"]))
        check("china tickets (200)", r.status_code == 200, r)
        r = await c.get(f"{BASE}/china/stats", headers=hdr(tokens["china_worker"]))
        check("china stats (200)", r.status_code == 200, r)

        # ── #1 Rasm: specs endpointlari photo qaytaradi ─────────────────
        r = await c.get(f"{BASE}/warehouse/uz/products/specs", headers=hdr(tokens["warehouse_uz"]))
        wh_ok = r.status_code == 200 and (len(r.json()) == 0 or "photo" in r.json()[0])
        check("wh specs returns photo field", wh_ok, r)
        r = await c.get(f"{BASE}/admin/products/specs", headers=hdr(tokens["admin"]))
        adm_ok = r.status_code == 200 and (len(r.json()) == 0 or "photo" in r.json()[0])
        check("admin specs returns photo field", adm_ok, r)

        # ── #2/#3 Carrier savat → WH approve oqimi ──────────────────────
        cid = str(ids["carrier"])
        r = await c.post(
            f"{BASE}/warehouse/uz/quick-intake",
            headers=hdr(tokens["warehouse_uz"]),
            json={"name": "Verify carrier mahsulot", "quantity": 1, "weight_g": 400,
                  "category": "Test", "cargo_price": 5, "total_value": 50, "photos": []},
        )
        spec_id = r.json().get("spec_id") if r.status_code in (200, 201) else None
        check("wh quick-intake creates product", bool(spec_id), r)

        if spec_id:
            r = await c.post(f"{BASE}/basket/add-by-spec", headers=hdr(tokens["carrier"]),
                             json={"spec_id": spec_id})
            check("carrier add-by-spec (201)", r.status_code == 201, r)

            r = await c.post(f"{BASE}/basket/checkout", headers=hdr(tokens["carrier"]),
                             json={"uz_pickup": "warehouse", "tr_handoff": "airport"})
            check("carrier checkout (200)", r.status_code == 200, r)

            r = await c.get(f"{BASE}/warehouse/uz/pending-pickups", headers=hdr(tokens["warehouse_uz"]))
            grp = next((g for g in r.json() if g["carrier_id"] == cid), None) if r.status_code == 200 else None
            check("wh sees carrier pending_approval", bool(grp) and grp.get("pending_approval") is True, r)

            r = await c.post(f"{BASE}/warehouse/uz/picks/{cid}/approve", headers=hdr(tokens["warehouse_uz"]))
            check("wh approve carrier picks (200)", r.status_code == 200, r)

            r = await c.get(f"{BASE}/carrier/picks", headers=hdr(tokens["carrier"]))
            approved = any(p.get("wh_approved_at") for p in r.json()) if r.status_code == 200 else False
            check("carrier sees approved pick", approved, r)

        # ── #3 Reject yo'li + yangi delivery opsiyalari (address/hotel) ──
        r = await c.post(
            f"{BASE}/warehouse/uz/quick-intake",
            headers=hdr(tokens["warehouse_uz"]),
            json={"name": "Verify reject mahsulot", "quantity": 1, "weight_g": 300,
                  "category": "Test", "cargo_price": 5, "total_value": 40, "photos": []},
        )
        spec_id2 = r.json().get("spec_id") if r.status_code in (200, 201) else None
        if spec_id2:
            await c.post(f"{BASE}/basket/add-by-spec", headers=hdr(tokens["carrier"]),
                         json={"spec_id": spec_id2})
            r = await c.post(f"{BASE}/basket/checkout", headers=hdr(tokens["carrier"]),
                json={"uz_pickup": "address", "delivery_address_uz": "Toshkent, Chilonzor 1",
                      "tr_handoff": "hotel", "carrier_address_tr": "Istanbul Hotel Plaza"})
            check("carrier checkout address+hotel (200)", r.status_code == 200, r)

            r = await c.post(f"{BASE}/warehouse/uz/picks/{cid}/reject",
                             headers=hdr(tokens["warehouse_uz"]), json={"reason": "Test rad etish"})
            check("wh reject carrier picks (200)", r.status_code == 200, r)

            r = await c.get(f"{BASE}/carrier/picks", headers=hdr(tokens["carrier"]))
            rejected = any(p.get("wh_rejected_at") for p in r.json()) if r.status_code == 200 else False
            check("carrier sees rejected pick", rejected, r)

        # ── Checkout validatsiyasi: address tanlandi, manzil yo'q → 4xx ──
        if spec_id2:
            await c.post(f"{BASE}/basket/add-by-spec", headers=hdr(tokens["carrier"]),
                         json={"spec_id": spec_id2})
            r = await c.post(f"{BASE}/basket/checkout", headers=hdr(tokens["carrier"]),
                json={"uz_pickup": "address", "tr_handoff": "airport"})
            check("checkout rejects missing address (4xx)", 400 <= r.status_code < 500, r)

        # ── Intake rejimlari: tekstil / quti / validatsiya ──────────────
        # Tekstil endi items_per_container'siz (har Product = 1 dona, vazn frontda hisoblanadi)
        r = await c.post(f"{BASE}/warehouse/uz/quick-intake", headers=hdr(tokens["warehouse_uz"]),
            json={"name": "Verify tekstil", "quantity": 5, "weight_g": 5000, "mode": "textile",
                  "cargo_price": 10, "total_value": 100, "photos": []})
        check("textile intake (items_per_container'siz)", r.status_code in (200, 201), r)
        r = await c.post(f"{BASE}/warehouse/uz/quick-intake", headers=hdr(tokens["warehouse_uz"]),
            json={"name": "Verify quti", "quantity": 3, "weight_g": 8000, "mode": "box",
                  "items_per_container": 20, "cargo_price": 5, "total_value": 50, "photos": []})
        check("box intake (201/200)", r.status_code in (200, 201), r)
        r = await c.get(f"{BASE}/warehouse/uz/products/specs", headers=hdr(tokens["warehouse_uz"]))
        has_mode = r.status_code == 200 and (len(r.json()) == 0 or "sourcing_mode" in r.json()[0])
        check("wh specs returns sourcing_mode", has_mode, r)
        r = await c.post(f"{BASE}/warehouse/uz/quick-intake", headers=hdr(tokens["warehouse_uz"]),
            json={"name": "Verify bad box", "quantity": 2, "weight_g": 1000, "mode": "box", "photos": []})
        check("box intake without items rejected (4xx)", 400 <= r.status_code < 500, r)

        # ── DELETE guard: omboridagi o'chsin, carrier'dagi bloklansin ────
        r = await c.post(f"{BASE}/warehouse/uz/quick-intake", headers=hdr(tokens["warehouse_uz"]),
            json={"name": "Verify delete OK", "quantity": 1, "weight_g": 200,
                  "category": "Test", "cargo_price": 1, "total_value": 10, "photos": []})
        del_prod = r.json().get("products", [{}])[0].get("id") if r.status_code in (200, 201) else None
        if del_prod:
            r = await c.delete(f"{BASE}/warehouse/uz/products/{del_prod}", headers=hdr(tokens["warehouse_uz"]))
            check("delete omboridagi mahsulot (200)", r.status_code == 200, r)

        # Yangi mahsulot → carrier savatiga → checkout (WITH... emas, lekin IN_BASKET emas:
        # approve qilingach pick bor, lekin o'chirish guard product.status bo'yicha).
        # Carrier'ga berilgan (WITH_CARRIER) holatni simulyatsiya qilish uchun DB'da status o'zgartiramiz.
        r = await c.post(f"{BASE}/warehouse/uz/quick-intake", headers=hdr(tokens["warehouse_uz"]),
            json={"name": "Verify delete BLOCK", "quantity": 1, "weight_g": 200,
                  "category": "Test", "cargo_price": 1, "total_value": 10, "photos": []})
        block_prod = r.json().get("products", [{}])[0].get("id") if r.status_code in (200, 201) else None
        if block_prod:
            from app.infra.db.session import AsyncSessionLocal as _S
            from app.infra.db.models.product import Product as _P
            from app.domain.enums import ProductStatus as _PS
            import uuid as _uuid
            async with _S() as _s:
                _p = await _s.get(_P, _uuid.UUID(block_prod))
                _p.status = _PS.WITH_CARRIER.value
                await _s.commit()
            r = await c.delete(f"{BASE}/warehouse/uz/products/{block_prod}", headers=hdr(tokens["warehouse_uz"]))
            check("delete carrier'dagi mahsulot bloklandi (409)", r.status_code == 409, r)

        # ── Role-guard smoke ────────────────────────────────────────────
        r = await c.get(f"{BASE}/admin/debts?status=all", headers=hdr(tokens["orderer"]))
        check("role-guard: orderer → admin (403)", r.status_code == 403, r)


async def main() -> int:
    print("=== AliBridge verify_dev ===")
    print("[1/2] Seeding 8 roles + minting JWTs...")
    tokens, ids = await seed_tokens()
    print(f"      tokens: {', '.join(tokens.keys())}")
    print("[2/2] Running flow checks...")
    await run_checks(tokens, ids)

    passed = sum(1 for _, ok, _ in _results if ok)
    total = len(_results)
    print(f"\n=== NATIJA: {passed}/{total} PASS ===")
    failed = [n for n, ok, _ in _results if not ok]
    if failed:
        print("FAILED:")
        for n in failed:
            print(f"  - {n}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
