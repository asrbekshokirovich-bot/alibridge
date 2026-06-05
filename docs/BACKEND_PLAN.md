# ALI BRIDGE — Backend qurilish rejasi

> Asos: `docs/API_CONTRACT.md` (35 endpoint). Stack: FastAPI + PostgreSQL (Supabase) + aiogram + JWT.
> Tartib: Poydevor → DB → Bot+Auth → rollar → bildirishnoma → ulash.

---

## 0. Texnologiyalar

| Qatlam | Texnologiya |
|--------|-------------|
| Til | Python 3.12+ |
| Web | FastAPI + Uvicorn |
| Bot | aiogram 3.x |
| DB | PostgreSQL 16 (Supabase pooler — `.env` da) |
| ORM | SQLAlchemy 2.0 (async) + asyncpg |
| Migration | Alembic |
| Auth | JWT (python-jose) + Telegram initData HMAC |
| Barkod | python-barcode (Code-128) + reportlab (PDF yorliq) |
| Cache/Queue | Redis (ixtiyoriy, keyin) |
| Validatsiya | Pydantic v2 |

Bitta process: **FastAPI + aiogram birga** (kontraktda shunday). Bot `BOT_FORCE_POLLING=true` (dev) yoki webhook.

---

## 1. Papka strukturasi

```
backend/
├── pyproject.toml          # bog'liqliklar
├── Dockerfile
├── alembic.ini
├── alembic/
│   ├── env.py
│   └── versions/
└── app/
    ├── main.py             # FastAPI + bot startup
    ├── core/
    │   ├── config.py       # pydantic-settings (.env)
    │   ├── security.py     # JWT yaratish/tekshirish, initData HMAC
    │   └── barcode.py      # ALB-NNNNNN generatsiya + PDF yorliq
    ├── db/
    │   ├── base.py         # SQLAlchemy Base, engine, session
    │   └── models.py       # barcha ORM modellar
    ├── schemas/            # Pydantic request/response (kontrakt bo'yicha)
    │   ├── auth.py, product.py, order.py, admin.py, scan.py ...
    ├── api/
    │   ├── deps.py         # get_db, get_current_user, require_role
    │   └── v1/
    │       ├── router.py   # barcha routerlarni yig'ish
    │       └── endpoints/
    │           ├── auth.py
    │           ├── carrier.py
    │           ├── warehouse_uz.py
    │           ├── warehouse_tr.py
    │           ├── courier_uz.py
    │           ├── courier_tr.py
    │           └── admin.py
    ├── services/           # biznes mantiq
    │   ├── barcode_service.py
    │   ├── order_service.py
    │   ├── custody_service.py   # yuk egaligi o'tishi (scan)
    │   └── payment_service.py   # to'lov avto-hisobi
    └── bot/
        ├── instance.py     # Bot + Dispatcher singleton
        ├── handlers.py     # /start → Mini App tugma
        └── notify.py       # bildirishnoma yuborish funksiyalari
```

---

## 2. DB modellar (jadvallar)

### `users`
| Maydon | Tur | Izoh |
|--------|-----|------|
| id | PK | |
| telegram_id | bigint, unique | |
| first_name, last_name | str | |
| phone | str | |
| passport | str, nullable | shifrlangan saqlash tavsiya |
| role | enum | orderer/warehouse_uz/warehouse_tr/china_worker/carrier/courier_uz/courier_tr/admin/pending |
| carrier_number | int, nullable, unique | faqat carrier (ketma-ket) |
| is_active | bool | |
| created_at | timestamp | |

### `products` (katalog / yuk)
| Maydon | Tur | Izoh |
|--------|-----|------|
| id | PK | |
| barcode | str, unique | ALB-NNNNNN |
| name, category | str | |
| type | enum | piece / weight |
| quantity | int | mavjud dona |
| weight_kg | numeric(18,4) | mavjud kg |
| unit_weight_kg | numeric, nullable | 1 dona vazni (donali) |
| box_weight_kg | numeric, nullable | kartonka (kiloli) |
| cargo_price | numeric(18,4) | dona/kg narxi |
| status | enum | in_warehouse_uz/pending_admin/confirmed/with_carrier/delivered_tr/damaged |
| received_date | date | qabul sanasi |
| image_url | str, nullable | |
| created_by | FK users | qabul qilgan ombor xodimi |
| created_at | timestamp | |

### `orders` (yo'lovchi buyurtmasi)
| Maydon | Tur | Izoh |
|--------|-----|------|
| id | PK | |
| carrier_id | FK users | yo'lovchi |
| pickup_type | enum | self / courier |
| pickup_address | str, nullable | |
| delivery_address_tr | str | |
| status | enum | pending_admin/confirmed/with_carrier/delivered_tr |
| created_at | timestamp | |

### `order_items`
| id PK | order_id FK | product_id FK | amount numeric (dona yoki kg) | actual_quantity int nullable (kiloli tortilgach) |

### `disputes` (shikast)
| id PK | product_id FK | carrier_id FK | reported_by FK | barcode | note | status enum(open/resolved/rejected) | created_at |

### `payments` (yo'lovchiga to'lov)
| id PK | carrier_id FK | products_count int | total_amount numeric | status enum(unpaid/paid) | created_at | paid_at nullable |

### `walk_in_customers` (Telegramsiz)
| id PK | name | phone | note | created_by FK | created_at |

### `staff_requests` (xodim so'rovi)
| id PK | user_id FK | status enum(pending/approved/rejected) | created_at |
> Eslatma: user.role=pending bilan ham boshqarish mumkin. Alohida jadval audit uchun yaxshi.

### `custody_events` (yuk egaligi — APPEND ONLY)
| id PK | product_id FK | from_holder_type/id | to_holder_type/id | event_type | scanned_by FK | created_at |
> Invariant: faqat INSERT. Har scan = 1 yozuv. (init.sql da trigger bor.)

---

## 3. Bosqichlar (build tartibi)

### Bosqich 1 — Poydevor `[#15]`
- `pyproject.toml` (fastapi, uvicorn, aiogram, sqlalchemy, asyncpg, alembic, pydantic-settings, python-jose, python-barcode, reportlab)
- `core/config.py` — `.env` dan barcha sozlamalar
- `db/base.py` — async engine, session, Base
- `main.py` — bo'sh FastAPI app, `/health` endpoint
- `Dockerfile` (multi-stage: development target)
- **Sinov:** `docker compose up backend` → `/health` 200

### Bosqich 2 — DB modellar `[#16]`
- `db/models.py` — yuqoridagi barcha jadvallar
- `core/enums.py` — Role, ProductType, ProductStatus, va h.k.
- Alembic init + birinchi migration
- **Sinov:** `alembic upgrade head` → jadvallar Supabase'da yaratiladi

### Bosqich 3 — Bot + Auth `[#17]`
- `bot/instance.py` — Bot + Dispatcher
- `bot/handlers.py` — `/start` → "Mini App'ni ochish" tugma (WebApp button)
- `core/security.py` — JWT encode/decode, Telegram initData HMAC tekshirish
- `api/v1/endpoints/auth.py` — `POST /auth/register`
- `api/deps.py` — `get_current_user`, `require_role`
- `main.py` da bot'ni startup'da ishga tushirish (polling)
- **Sinov:** Telegram'da `/start` → app ochiladi → register → JWT keladi

### Bosqich 4 — Carrier `[#18]`
- `GET /products/catalog`, `POST /carrier/orders`, `GET /carrier/orders`,
  `GET /couriers/uz/active`, `POST /carrier/auto-receive`
- `services/order_service.py`
- **Sinov:** frontend carrier paneli haqiqiy API bilan

### Bosqich 5 — Warehouse UZ + Barkod `[#19]`
- `core/barcode.py` — ALB-NNNNNN ketma-ket generatsiya, Code-128 + reportlab PDF yorliq (nom+sana+shtrix)
- `GET /warehouse-uz/stats`, `POST /warehouse-uz/receive` (barkod+PDF),
  `pending-weigh`, `confirm-weigh`, scan/confirm (carrier, courier)
- `services/custody_service.py` — scan = egalik o'tishi
- **PDF endpoint:** `GET /labels/{barcode}.pdf` (yoki static fayl)
- **Sinov:** yuk qabul → PDF yuklanadi; skanlash → status o'zgaradi

### Bosqich 6 — Courier UZ/TR + Warehouse TR `[#20]`
- courier-uz: queue, scan-pickup, confirm-pickup, scan-airport, confirm-airport
- courier-tr: scan-receive, confirm-receive, report-damaged, deliveries, scan-delivery, confirm-delivery
- warehouse-tr: scan-receive, confirm-receive, scan-handover, confirm-handover, walk-in, uz-products
- **Sinov:** to'liq yuk zanjiri (UZ ombor → kuryer → yo'lovchi → TR kuryer → yetkazish)

### Bosqich 7 — Admin `[#21]`
- stats, staff-requests (approve/reject), carriers, disputes (update), payments (mark-paid)
- `services/payment_service.py` — yuk tashilgach to'lov avto-hisobi
- **Sinov:** xodim tasdiqlash, nizo, to'lov hisoboti

### Bosqich 8 — Bildirishnomalar `[#22]`
- `bot/notify.py`:
  - Yo'lovchi buyurtma berdi → ombor + admin
  - Admin tasdiqladi → yo'lovchi ("yukni kuting")
  - Xodim so'rovi → admin (inline tugma yoki app)
  - Shikast qayd etildi → admin + wh_tr
- **Sinov:** har bildirishnoma kelishi

### Bosqich 9 — Ulash `[#23]`
- Frontend `.env`: `VITE_USE_MOCK=false`
- `docker compose up` (backend+frontend+redis+cloudflared)
- Cloudflare tunnel HTTPS → BotFather'ga Mini App URL
- End-to-end: real Telegram'da to'liq oqim
- **Sinov:** haqiqiy qurilmada to'liq ish

---

## 4. Muhim biznes qoidalar (invariantlar)

1. **Barkod:** 1 kategoriya = 1 barkod (ALB-NNNNNN), quantity nusxa. PDF: nom+sana tepa, shtrix past.
2. **Egalik (custody):** bir vaqtda bitta egada. Har scan custody_events'ga yoziladi (append-only).
3. **Kiloli yuk:** yo'lovchi kg so'raydi → ombor tortib actual_quantity (dona) kiritadi.
4. **Narx qulflanadi:** order_item yaratilganda cargo_price nusxalanadi (keyin o'zgarmaydi).
5. **Pul:** har doim numeric (float emas).
6. **Firewall:** carrier box_weight/ichki narx ko'rmaydi; rollar faqat o'z ma'lumotini.
7. **initData:** har register'da Telegram HMAC server tomonda tekshiriladi.
8. **Yo'lovchi raqami:** ketma-ket, register'da beriladi, o'zgarmaydi.

---

## 5. Hали keyin (v2)
- `orderer` (buyurtmachi) — endpoint + frontend
- `china_worker` (Xitoy ishchisi) — endpoint + frontend
- Redis cache, arq background jobs
- S3/MinIO rasm yuklash
- FX kurslar, SMS (Eskiz)

---

## Holat: REJA TAYYOR — build bosqich 1 dan boshlanadi.
