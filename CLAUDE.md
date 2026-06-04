# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ALI BRIDGE** — Telegram Mini App for cargo logistics (China → Uzbekistan → Turkey). Passengers (carriers) physically carry goods on flights.

## Commands

### Run everything (Docker)
```bash
docker compose up --build -d        # full stack
docker compose ps                   # check status
docker compose logs -f backend      # stream backend logs
docker compose restart frontend     # after frontend changes
docker compose build frontend && docker compose up -d frontend  # rebuild frontend
```

### Backend (inside container or with Poetry)
```bash
docker compose exec backend alembic upgrade head   # run migrations
docker compose exec backend alembic revision --autogenerate -m "name"  # new migration

# Local (requires postgres + redis running)
cd backend && poetry install
poetry run uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev          # dev server (port 5173)
npm run build        # production build
npm run type-check   # TypeScript check
npm run lint         # ESLint
npm run lint:fix     # ESLint with auto-fix
```

### Testing (Backend)
```bash
cd backend
pytest                                          # all tests
pytest tests/unit/                              # unit only
pytest tests/scenarios/                         # scenario tests
pytest tests/unit/test_auth.py                  # single file
pytest tests/unit/test_auth.py::test_login      # single test
pytest -m unit                                  # by marker
pytest -m integration                           # requires DB + Redis
pytest --cov=app --cov-report=html              # with coverage
```

### Linting (Backend)
```bash
cd backend
ruff check .          # lint
ruff check . --fix    # auto-fix
black .               # format
mypy app/             # type check
```

## Architecture

### Process Model
A single backend process runs **FastAPI** (REST for Mini App) + **aiogram** (Telegram bot) together. The bot uses either webhook (`/api/v1/telegram/webhook`) or long-polling depending on `BOT_FORCE_POLLING` env var. Cloudflare tunnel URL is auto-detected from `/cf_shared/tunnel.log` for ephemeral dev HTTPS.

### User Roles (7 total)
`orderer` · `china_worker` · `warehouse_uz` · `warehouse_tr` · `carrier` · `courier_uz` · `courier_tr` · `admin`

Each role has its own frontend feature module (`frontend/src/features/<role>/`) with separate routes, dashboard, and components. Role is embedded in JWT and enforced via `require_role()` dependency on every backend endpoint and `RoleGuard` on frontend routes.

### Backend Layer Structure (`backend/app/`)
```
api/v1/endpoints/   → FastAPI route handlers (thin: validate, call service, return)
services/           → Business logic / use cases
repositories/       → SQLAlchemy async queries
domain/
  entities/         → Pydantic domain models
  value_objects/    → Money, Weight (immutable, no floats — Decimal only)
  state_machines/   → Order/custody FSM transitions
  enums.py          → All status enums
infra/
  db/models/        → SQLAlchemy ORM models
  telegram/bot.py   → Bot + Dispatcher singleton
  cache/            → Redis client
  storage/          → S3 (aioboto3)
  fx/               → Currency rate providers
  qr/               → QR HMAC signing
bot/routers/        → aiogram message/callback handlers per role
workers/            → arq background jobs (basket TTL, FX refresh)
core/config.py      → All settings via pydantic-settings from .env
```

### Frontend Pattern (`frontend/src/`)
```
features/<role>/    → Role-specific pages + routes.tsx
shared/
  api/client.ts     → Axios instance with JWT interceptor + error normalization
  store/auth.ts     → Zustand auth store (token, roles, profile)
  hooks/            → useTelegram (haptics, back button, Telegram SDK)
  types/api.ts      → Shared API response types
app/router.tsx      → Root router; mounts RoleLayout which loads correct feature routes
```

Server state is managed with **TanStack Query** (`useQuery`/`useMutation`). Error responses always have the shape `{ error: { code, message, details } }` — use `extractErrorMessage()` from `shared/api/client.ts`.

### Key Invariants
- **Money**: always `Decimal`, never `float`. Use `Money` value object or `Numeric(18,4)` in DB.
- **Custody**: one holder at a time. Transfers recorded in `custody_events` table; `products` table has denormalized `custody_holder_type/id`.
- **Price locking**: `cargo_price_uz_to_tr` is copied to `carrier_picks.locked_cargo_price` at pick time and never changes after.
- **QR codes**: signed with HMAC (`QrSigner`). Never trust unsigned QR payloads.

### Docker Services
| Service | Port | Notes |
|---|---|---|
| backend | 8000 | FastAPI + bot, hot-reload in dev |
| frontend | 5173 | nginx serving Vite production build |
| postgres | internal | PostgreSQL 16, no host port |
| redis | internal | Redis 7 with password |
| worker | — | arq background jobs |
| cloudflared | — | ephemeral HTTPS tunnel |
| minio | 9000/9001 | S3-compatible, dev only |

### Frontend ↔ Backend: Changes Require Rebuild
The frontend is a **production Vite build** served by nginx inside Docker. Code changes to `.tsx`/`.ts` files require:
```bash
docker compose build frontend && docker compose up -d frontend
```

### Adding a New API Endpoint
1. Create handler in `backend/app/api/v1/endpoints/<module>.py`
2. Register router in `backend/app/api/v1/router.py`
3. Add `require_role(Role.X)` dependency for access control
4. Add corresponding type in `frontend/src/shared/types/api.ts` if needed

### Adding a New Role Feature (Frontend)
1. Create `frontend/src/features/<role>/` with `routes.tsx` and `Dashboard.tsx`
2. Import routes in `frontend/src/app/router.tsx`
3. Wrap with `<RoleGuard role="<role>" />` in the route definition
