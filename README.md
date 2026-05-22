# ALI BRIDGE

> Telegram Bot + Mini App: Xitoy → Toshkent → Turkiya kargo zanjiri

Yo'lovchilar orqali Xitoydan Turkiyaga kargo yetkazib berish tizimi. Har bir paket barkod orqali kuzatiladi — Xitoy ombordan to'g'ridan-to'g'ri Turkiya omborigacha.

---

## 📋 Tarkib

- [Loyiha haqida](#loyiha-haqida)
- [Texnik stack](#texnik-stack)
- [Loyiha tuzilishi](#loyiha-tuzilishi)
- [O'rnatish](#ornatish)
- [Ishga tushirish](#ishga-tushirish)
- [Dokumentatsiya](#dokumentatsiya)

---

## Loyiha haqida

ALI BRIDGE — bu **end-to-end** kargo kuzatuv tizimi:

```
🇨🇳 Xitoy   →   🇺🇿 Toshkent   →   ✈️ Yo'lovchi   →   🇹🇷 Turkiya
   (sourcing)    (intake + label)     (carrier)        (delivery)
```

### 7 ta foydalanuvchi roli

| Rol | Vazifa |
|-----|--------|
| **Orderer** | Buyurtma beradi (TR'da yashaydi) |
| **China worker** | Xitoyda mahsulot sotib oladi |
| **Tashkent WH** | Toshkentda qabul qiladi, label yopishtiradi |
| **Carrier** | Yo'lovchi — Toshkentdan Turkiyaga olib ketadi |
| **UZ Courier** | Toshkent shahar ichida yetkazadi |
| **TR Courier** | Turkiyada carrier'dan olib ketadi |
| **TR WH** | Turkiya omborida yakuniy qabul |
| **Admin** | Barchasini boshqaradi |

### Asosiy xususiyatlar

✅ Telegram Mini App + Bot (hybrid)
✅ Barkod skanerlash (har bir handoff'da)
✅ Multi-language (UZ, RU, TR, EN)
✅ OCR (passport + bilet)
✅ Real-time tracking
✅ Per-pick payouts
✅ Dispute resolution
✅ Walk-in mijozlar (Telegramsiz)

---

## Texnik stack

### Backend
- **Python 3.12+**
- **aiogram 3.x** — Telegram bot
- **FastAPI** — Mini App API
- **PostgreSQL 16** — asosiy DB
- **Redis 7** — cache + FSM
- **SQLAlchemy 2.0** + **Alembic**
- **arq** — background jobs

### Frontend (Mini App)
- **React 18** + **TypeScript 5**
- **Vite 5** — build tool
- **TailwindCSS 3** — styling
- **TanStack Query** — server state
- **Zustand** — client state
- **@telegram-apps/sdk** — Telegram SDK

### Infrastructure
- **Docker** + **Docker Compose**
- **Nginx** — reverse proxy
- **Let's Encrypt** — SSL
- **S3 (Wasabi)** — fayl saqlash

---

## Loyiha tuzilishi

```
Telegram Mini App/
├── docs/              # Dokumentatsiya
├── backend/           # Python (FastAPI + aiogram)
│   ├── app/
│   │   ├── bot/       # aiogram routers
│   │   ├── api/       # FastAPI endpoints
│   │   ├── domain/    # Business logic
│   │   ├── services/  # Use cases
│   │   ├── repositories/  # DB access
│   │   ├── infra/     # External adapters
│   │   ├── workers/   # Background jobs
│   │   └── core/      # Config, security
│   ├── alembic/       # Migrations
│   └── tests/         # Tests
├── frontend/          # React Mini App
│   └── src/
│       ├── app/       # Entry
│       ├── features/  # Modules (per role)
│       └── shared/    # Reusable
├── infra/             # Nginx, Docker configs
├── docker-compose.yml
└── README.md
```

Batafsil arxitektura: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

---

## O'rnatish

### Talablar

- **Docker** + **Docker Compose** (v2+)
- **Git**
- **Node.js 20+** (lokal development uchun)
- **Python 3.12+** (lokal development uchun)

### Birinchi marta o'rnatish

```bash
# 1. Repository'ni klonlash (yoki bu papkada bo'lib turing)
cd "Telegram Mini App"

# 2. Environment faylini yaratish
cp .env.example .env
# .env faylini tahrirlang va o'z qiymatlaringizni qo'ying

# 3. Docker containerlarini ko'tarish
docker-compose up -d

# 4. Database migration
docker-compose exec backend alembic upgrade head

# 5. Boshlang'ich ma'lumotlar
docker-compose exec backend python -m app.scripts.seed
```

---

## Ishga tushirish

### Development mode

```bash
# Hammasini ishga tushirish
docker-compose up

# Faqat database va Redis
docker-compose up -d postgres redis

# Backend (lokal)
cd backend
poetry install
poetry run python -m app.main

# Frontend (lokal)
cd frontend
npm install
npm run dev
```

### Production mode

```bash
docker-compose -f docker-compose.prod.yml up -d
```

Batafsil: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)

---

## Bot setup

### 1. Telegram'da @BotFather'dan bot yarating

```
/newbot
Bot name: ALI BRIDGE
Username: alibridge_bot
```

### 2. Token'ni `.env` ga qo'ying

```env
BOT_TOKEN=123456789:ABC-DEF...
```

### 3. Mini App'ni ulash

@BotFather'da:
```
/mybots → ALI BRIDGE → Bot Settings → Configure Mini App
Web App URL: https://yourdomain.com
```

---

## Dokumentatsiya

| Hujjat | Tavsif |
|--------|--------|
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Loyiha arxitekturasi |
| [DATABASE.md](./docs/DATABASE.md) | Database sxemasi |
| [API.md](./docs/API.md) | REST API endpoints |
| [DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Deploy qo'llanma |
| [DEV_PLAN_V2](./docs/DEV_PLAN_V2.docx) | Asosiy reja (v2.0) |

---

## Testlar

```bash
# Backend
cd backend
pytest

# Faqat unit testlar
pytest tests/unit

# Stsenariy testlari
pytest tests/scenarios

# Coverage bilan
pytest --cov=app --cov-report=html
```

---

## 5 ta o'zgarmas qoida (Invariants)

1. **Single-holder custody** — har bir paket bitta egada
2. **Information firewall** — har bir rol o'z ko'rinishida
3. **Price locked at pick** — kuryer narxi blok qilinadi
4. **Each scan = own transaction** — atomic skan
5. **Dual confirmation** — har ikki tomon tasdiqlashi shart

---

## Litsenziya

Proprietary — ALI BRIDGE © 2025

---

## Aloqa

- Loyiha: ALI BRIDGE
- Versiya: 1.0.0
- Status: 🚧 Development

