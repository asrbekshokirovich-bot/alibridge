# ALI BRIDGE — Loyiha Arxitekturasi

> Telegram Bot + Mini App: Xitoy → Toshkent → Turkiya kargo zanjiri
> Versiya: 1.0 (v2.0 development plan asosida)

---

## 1. UMUMIY ARXITEKTURA

### 1.1 Yuqori darajadagi sxema

```
┌──────────────────────────────────────────────────────────────────┐
│                        FOYDALANUVCHILAR                           │
│  ┌─────────┬─────────┬────────────┬──────────┬─────────────┐    │
│  │ Orderer │ Carrier │ UZ/TR WH   │ Courier  │ China/Admin │    │
│  └─────────┴─────────┴────────────┴──────────┴─────────────┘    │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ↓ Telegram'da ochish
┌──────────────────────────────────────────────────────────────────┐
│                  TELEGRAM PLATFORMA                                │
│  ┌─────────────────────────┬──────────────────────────────────┐  │
│  │   Bot (aiogram 3.x)     │   Mini App (React + TS)          │  │
│  │   - /start, til         │   - Katalog (50k items)          │  │
│  │   - Bildirishnomalar    │   - Korzina                       │  │
│  │   - Tezkor harakatlar   │   - Barkod skaner                 │  │
│  │   - Mini App ochish     │   - Dashboard, statistika        │  │
│  └─────────────────────────┴──────────────────────────────────┘  │
└────────────────────┬─────────────────────────────────────────────┘
                     │ HTTPS / Webhook
                     ↓
┌──────────────────────────────────────────────────────────────────┐
│              BACKEND (Modular Monolith)                            │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Presentation Layer                                         │  │
│  │  ┌──────────────┬──────────────────┬──────────────────┐    │  │
│  │  │  Bot Routers │  FastAPI (REST)  │  Webhooks        │    │  │
│  │  │  (aiogram)   │  (Mini App API)  │  (Yandex, SMS)   │    │  │
│  │  └──────────────┴──────────────────┴──────────────────┘    │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  Application Layer (Services / Use Cases)                   │  │
│  │  create_order, intake_shipment, scan_handoff,               │  │
│  │  request_payout, resolve_dispute, ...                       │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  Domain Layer (Pure business logic)                         │  │
│  │  • Custody State Machine  • Order Status                    │  │
│  │  • Value Objects          • Domain Events                   │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  Infrastructure Layer                                       │  │
│  │  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────────┐    │  │
│  │  │  DB  │Cache │ OCR  │ SMS  │ S3   │  FX  │ Labels   │    │  │
│  │  └──────┴──────┴──────┴──────┴──────┴──────┴──────────┘    │  │
│  └────────────────────────────────────────────────────────────┘  │
└────────────────────┬─────────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┬─────────────┬──────────────┐
        ↓            ↓            ↓             ↓              ↓
   ┌─────────┐  ┌─────────┐  ┌──────────┐ ┌──────────┐ ┌────────────┐
   │ Postgre │  │  Redis  │  │   S3     │ │  Google  │ │  Eskiz.uz  │
   │  SQL 16 │  │   7     │  │ (Wasabi) │ │  Vision  │ │   (SMS)    │
   └─────────┘  └─────────┘  └──────────┘ └──────────┘ └────────────┘
```

---

## 2. CLEAN ARCHITECTURE (Tozaqavat arxitektura)

Kod 4 ta qatlamga bo'lingan. Tashqi qatlam ichki qatlamga bog'liq, lekin **teskari emas**.

```
┌─────────────────────────────────────────────────────────────────┐
│  PRESENTATION (Bot + API + Mini App)                            │
│  ↓ chaqiradi                                                     │
├─────────────────────────────────────────────────────────────────┤
│  APPLICATION (Services / Use Cases)                              │
│  ↓ chaqiradi                                                     │
├─────────────────────────────────────────────────────────────────┤
│  DOMAIN (Pure business logic — eng ichki qatlam)                 │
│  ↑ ishlatadi                                                     │
├─────────────────────────────────────────────────────────────────┤
│  INFRASTRUCTURE (DB, Cache, OCR, SMS) — Application ga xizmat   │
└─────────────────────────────────────────────────────────────────┘
```

### Domain Layer
- **Hech qanday tashqi bog'lanish yo'q** (DB, HTTP, fayl tizimi yo'q)
- Faqat sof biznes mantiq
- Eng muhim: `CustodyStateMachine` — Invariant 1

### Application Layer (Services)
- Use case'larni amalga oshiradi
- Repository'larni chaqiradi
- Tranzaksiyalarni boshqaradi

### Infrastructure Layer
- PostgreSQL bilan ishlash (SQLAlchemy)
- Redis cache
- Telegram API
- OCR (PassportEye + Google Vision)
- S3 storage
- SMS yuborish

### Presentation Layer
- **Bot routers** (aiogram) — Telegram bot uchun
- **API endpoints** (FastAPI) — Mini App uchun
- **Webhooks** — Yandex, SMS delivery uchun

---

## 3. ROL-BASED ACCESS CONTROL (RBAC)

### 3.1 7 ta rol va ko'rinish darajasi

| Rol | Ko'rinish | Maxfiy bo'lgan ma'lumotlar |
|-----|-----------|---------------------------|
| **Orderer** | O'z buyurtmalari | Boshqa orderer, kuryer, narx margin |
| **China worker** | Sourcing tickets | Orderer ID, customer paid, product QR |
| **Tashkent WH** | Intake, products, catalog | China sourcing prices, payouts |
| **TR WH** | TR orderlari, kelgan kuryerlar | China data, passport raqamlari |
| **Carrier** | Filtered catalog, basket | Boshqa carrier korzinasi, margin |
| **UZ/TR Courier** | Dispatch queue, scans | Catalog, payouts, carrier private |
| **Admin** | Hammasi | — |

### 3.2 Repository-level enforcement

**MUHIM:** Visibility (ko'rinish) qoidalari **repository qatlamida** ishlaydi, **UI qatlamida emas**.

```python
# To'g'ri: China worker repo'da orderer_id MAVJUD EMAS
class ChinaSourcingRepo:
    def get_open_tickets(self) -> List[SourcingTicket]:
        # SQL'da JOIN'lar yo'q, orderer_id maydoni qaytarilmaydi
        # Bu ma'lumot fizik jihatdan response'ga kirmaydi
        pass

# Noto'g'ri: UI darajasida yashirish
# if user.role == 'china': hide(orderer_id)  ← XAVFLI
```

Bu **Invariant 2** — Information Firewall.

---

## 4. 5 TA DESIGN INVARIANT (O'zgarmas qoidalar)

Kodning **HAR BIR QATORI** bu qoidalarga rioya qilishi shart.

### Invariant 1: Single-Holder Custody
> Har bir paketda **bitta** egasi bo'ladi.

- `custody_events` jadvali **append-only** (faqat INSERT)
- PostgreSQL role permissions UPDATE/DELETE'ni bloklaydi
- Holat o'zgarishi state machine orqali validatsiyalanadi

### Invariant 2: Information Firewall by Role
> Rol uchun cheklangan maydonlar **kodda mavjud emas**.

- Repository methodi role-typed
- China repo'da `orderer_id` ustuni yo'q
- "Hostile worker" testlari bu qoidani tekshiradi

### Invariant 3: Price-At-Pick is Locked
> Carrier ko'rgan narx pick payti **lock qilinadi**.

- `carrier_picks.locked_cargo_price` ustuni
- Keyingi narx o'zgarishlari bu pick'ga ta'sir qilmaydi

### Invariant 4: Every Scan = Own Transaction
> Har bir skan **alohida** commit qilinadi.

- Session — UI abstraction
- 30 ta itemdan 18-tasini skanerlab crash bo'lsa — 18 ta saqlanadi
- 19-itemdan resume qiladi

### Invariant 5: Dual Confirmation for Handoffs
> Custody transfer **ikki tomonlama** tasdiqlanadi.

- Sender scan + Receiver scan, YOKI
- Sender scan + Receiver 6-digit code, YOKI
- Tamper-evident seal (Yandex uchun)

---

## 5. PROJECT STRUCTURE

```
Telegram Mini App/
├── docs/                          # Dokumentatsiya
│   ├── ARCHITECTURE.md            # Bu fayl
│   ├── DATABASE.md                # DB sxemasi
│   ├── API.md                     # API endpoints
│   ├── DEPLOYMENT.md              # Deploy qo'llanma
│   └── DEV_PLAN_V2.docx           # Asosiy reja
│
├── backend/                       # Python backend
│   ├── app/
│   │   ├── bot/                   # aiogram routers
│   │   │   ├── routers/
│   │   │   │   ├── orderer/       # Orderer flow
│   │   │   │   ├── carrier/       # Carrier flow
│   │   │   │   ├── warehouse_uz/  # UZ warehouse
│   │   │   │   ├── warehouse_tr/  # TR warehouse
│   │   │   │   ├── china/         # China sourcing
│   │   │   │   ├── couriers/      # UZ + TR couriers
│   │   │   │   └── admin/         # Admin panel
│   │   │   ├── keyboards/         # Inline keyboards
│   │   │   ├── middlewares/       # Auth, i18n, role
│   │   │   └── states/            # FSM states
│   │   │
│   │   ├── api/                   # FastAPI (Mini App uchun)
│   │   │   ├── v1/
│   │   │   │   └── endpoints/
│   │   │   │       ├── auth.py
│   │   │   │       ├── catalog.py
│   │   │   │       ├── basket.py
│   │   │   │       ├── orders.py
│   │   │   │       ├── scan.py
│   │   │   │       ├── payouts.py
│   │   │   │       └── admin.py
│   │   │   └── deps/              # Dependencies
│   │   │
│   │   ├── domain/                # ⭐ Pure business logic
│   │   │   ├── entities/          # Pydantic models
│   │   │   ├── value_objects/     # Money, Weight, etc.
│   │   │   ├── state_machines/    # CustodyStateMachine
│   │   │   └── events/            # Domain events
│   │   │
│   │   ├── services/              # ⭐ Use cases
│   │   │   ├── create_order.py
│   │   │   ├── intake_shipment.py
│   │   │   ├── bulk_create_products.py
│   │   │   ├── scan_handoff.py
│   │   │   ├── request_payout.py
│   │   │   └── resolve_dispute.py
│   │   │
│   │   ├── repositories/          # ⭐ Role-typed DB access
│   │   │   ├── base.py
│   │   │   ├── china_repo.py
│   │   │   ├── carrier_repo.py
│   │   │   ├── product_repo.py
│   │   │   └── order_repo.py
│   │   │
│   │   ├── infra/                 # External adapters
│   │   │   ├── db/                # SQLAlchemy
│   │   │   ├── cache/             # Redis
│   │   │   ├── ocr/               # PassportEye + Vision
│   │   │   ├── storage/           # S3
│   │   │   ├── sms/               # Eskiz.uz
│   │   │   ├── labels/            # PDF generation
│   │   │   ├── qr/                # HMAC-signed QR
│   │   │   ├── fx/                # FX rates
│   │   │   └── telegram/          # Bot client
│   │   │
│   │   ├── workers/               # Background jobs
│   │   │   ├── landing_ping.py    # 1h/6h/24h/72h ladder
│   │   │   ├── basket_ttl.py      # 20-min release
│   │   │   ├── fx_refresher.py    # 4h FX cache
│   │   │   └── dispute_reminder.py
│   │   │
│   │   ├── core/                  # Config, security, logger
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   ├── logger.py
│   │   │   └── exceptions.py
│   │   │
│   │   ├── i18n/                  # Multi-language
│   │   │   └── locales/           # uz, ru, tr, en
│   │   │
│   │   └── main.py                # Application entry
│   │
│   ├── alembic/                   # DB migrations
│   ├── tests/                     # Unit + Integration + Scenarios
│   ├── scripts/                   # Utility scripts
│   ├── pyproject.toml
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/                      # React Mini App
│   ├── src/
│   │   ├── app/                   # Entry point
│   │   │   ├── App.tsx
│   │   │   ├── router.tsx
│   │   │   └── providers.tsx
│   │   │
│   │   ├── features/              # Feature modules
│   │   │   ├── orderer/
│   │   │   ├── carrier/
│   │   │   ├── warehouse-uz/
│   │   │   ├── warehouse-tr/
│   │   │   ├── china/
│   │   │   ├── couriers/
│   │   │   ├── admin/
│   │   │   └── auth/
│   │   │
│   │   ├── shared/                # Reusable
│   │   │   ├── components/        # UI components
│   │   │   ├── hooks/             # Custom hooks
│   │   │   ├── api/               # API client
│   │   │   ├── utils/             # Helpers
│   │   │   ├── types/             # TS types
│   │   │   ├── i18n/              # Translations
│   │   │   ├── store/             # Zustand
│   │   │   └── styles/            # Tailwind config
│   │   │
│   │   ├── pages/                 # Page components
│   │   ├── layouts/               # Role-based layouts
│   │   └── assets/                # Images, fonts
│   │
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
│
├── infra/                         # Infrastructure
│   ├── nginx/                     # Reverse proxy
│   └── docker/                    # Docker configs
│
├── .github/workflows/             # CI/CD
├── docker-compose.yml             # Development
├── docker-compose.prod.yml        # Production
├── .gitignore
├── README.md
└── .env.example
```

---

## 6. DATA FLOW (Ma'lumot oqimi)

### 6.1 Misol: Carrier korzinaga item qo'shadi

```
1. User Mini App'da "Qo'shish" tugmasini bosadi
   ↓
2. Frontend: POST /api/v1/basket/add { product_id }
   ↓
3. FastAPI endpoint (api/v1/endpoints/basket.py)
   • JWT token validatsiya (Telegram initData)
   • User role tekshirish (CARRIER bo'lishi shart)
   ↓
4. Service: BasketService.add_item(user_id, product_id)
   • Product repository'dan product oladi
   • Carrier weight limit tekshiradi
   • Domain validation
   ↓
5. Domain: Carrier.can_carry(product) → bool
   • Sof biznes mantiq
   ↓
6. Repository: ProductRepo.lock_for_basket(product_id)
   • SELECT FOR UPDATE
   • carrier_picks INSERT (status=IN_BASKET)
   • basket_lock_until = now() + 20min
   ↓
7. Redis: cache invalidation
   ↓
8. Response: 201 Created
   ↓
9. Frontend: UI yangilanadi, "Korzinada" ko'rinadi
```

---

## 7. TEXNIK STACK

### 7.1 Backend

| Komponent | Texnologiya | Sabab |
|-----------|-------------|-------|
| Tili | Python 3.12+ | Async, ML kutubxonalari, batafsil ecosystem |
| Bot | aiogram 3.x | FSM, async, eng zamonaviy |
| API | FastAPI | Tezkor, OpenAPI, async |
| ORM | SQLAlchemy 2.0 | Type-safe, async support |
| Migration | Alembic | SQLAlchemy bilan integratsiya |
| Validation | Pydantic v2 | FastAPI bilan ishlaydi |
| Background | arq | Redis-based, oddiy |
| Test | pytest + pytest-asyncio | Standard |

### 7.2 Frontend

| Komponent | Texnologiya | Sabab |
|-----------|-------------|-------|
| Framework | React 18 | Eng mashhur, ko'p resurslar |
| Tili | TypeScript 5 | Type safety |
| Build | Vite 5 | Tezkor dev server |
| Stil | TailwindCSS 3 | Utility-first, tez |
| State | Zustand | Oddiy, kichik |
| Queries | TanStack Query v5 | Cache, sync |
| Router | React Router v6 | Standard |
| Forms | React Hook Form | Performant |
| Telegram | @telegram-apps/sdk | Rasmiy SDK |
| Barcode | html5-qrcode | Kamera skaner |
| i18n | i18next | Ko'p tilli |

### 7.3 Database va Cache

| Komponent | Texnologiya | Sabab |
|-----------|-------------|-------|
| DB | PostgreSQL 16 | Row-level locks, JSONB, FTS |
| Cache | Redis 7 | TTL, pub/sub, FSM state |
| Storage | S3 (Wasabi) | Arzon, S3-compatible |

### 7.4 DevOps

| Komponent | Texnologiya |
|-----------|-------------|
| Container | Docker + Docker Compose |
| Reverse proxy | Nginx |
| SSL | Let's Encrypt (Certbot) |
| Monitoring | Uptime Kuma + Grafana |
| Logs | structlog → Loki |
| Errors | Sentry |
| CI/CD | GitHub Actions |

---

## 8. KEY MODULES (Asosiy modullar)

### 8.1 Custody Module
- `custody_state_machine.py` — holat o'zgarishlari validatsiyasi
- `custody_events` jadvali — append-only ledger
- `scan_handoff.py` service — har bir skan alohida tx

### 8.2 Catalog Module
- 50k+ items uchun optimized
- PostgreSQL FTS (Full Text Search)
- Filter, sort, pagination
- Basket locking (20-min TTL)

### 8.3 Onboarding Module
- OCR pipeline (passport + ticket)
- Validation (passport expiry, route exists, etc.)
- First-trip safeguards (value cap, trust tier)

### 8.4 Handoff Module
- 3 ta mode: WH Pickup, Free Tashkent, Yandex
- Dual confirmation (Invariant 5)
- Tamper-evident seals

### 8.5 Payouts Module
- Per-pick eligibility
- FX rate locking
- Deductions (lost/damaged)

### 8.6 Disputes Module
- 4 ta tur: LOST, DAMAGED, WRONG_ITEM, NOT_RECEIVED
- Evidence collection (photos)
- Admin resolution workflow

---

## 9. SECURITY (Xavfsizlik)

### 9.1 Authentication
- Telegram `initData` HMAC-SHA256 validation
- Server side check (bot token bilan)
- JWT token (1h TTL) Mini App uchun

### 9.2 Authorization
- Role-based (7 rol)
- Repository-level enforcement
- "Hostile worker" tests

### 9.3 Data protection
- Passport rasmlari encrypted at rest (S3 SSE)
- Database connection — TLS only
- Secrets — environment variables, never in code

### 9.4 Audit log
- Har bir state change → `audit_log` jadvaliga
- 3 yil minimum retention
- Admin amallarini alohida ko'rsatish

---

## 10. SCALABILITY (Kengaytirilish)

### Hozirgi (v1) limits
- 50,000 mahsulot katalogda
- 200 ta concurrent carrier
- 1,000 items bulk creation < 5s
- Page-1 catalog < 600ms

### Kelajakda
- v2: Multi-tenant (boshqa logistika yo'nalishlari)
- v3: ML-based fraud detection
- v4: Auto-flight tracking
- v5: Mobile native apps

---

## 11. DEPLOYMENT

### Development
```bash
docker-compose up -d
# PostgreSQL, Redis, Backend, Frontend
```

### Production
```bash
# 1. Server: Ubuntu 22.04, 4GB RAM, 80GB SSD
# 2. Docker + Docker Compose
# 3. Nginx + Certbot
# 4. Automated backups (daily PostgreSQL dump)
```

Batafsil: `docs/DEPLOYMENT.md`

---

## 12. KEYINGI QADAMLAR

1. ✅ Loyiha strukturasi yaratildi
2. ⏳ Database sxemasi (PostgreSQL + Alembic)
3. ⏳ Custody state machine
4. ⏳ Backend skeleton (FastAPI + aiogram)
5. ⏳ Frontend skeleton (React + Vite)
6. ⏳ Docker Compose
7. ⏳ Birinchi end-to-end flow: User /start → Mini App'da Catalog ko'rish

---

**Hujjat oxiri** — Versiya 1.0
