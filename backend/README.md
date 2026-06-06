# ALI BRIDGE — Backend

FastAPI + aiogram (bitta process) + PostgreSQL (Supabase) + JWT.

## Ishga tushirish (Docker)

```bash
# Ildiz papkadan
docker compose up -d redis backend       # backend + redis
docker compose logs -f backend           # loglar
docker compose exec backend python -m app.seed   # test ma'lumotlari
```

`/health` → http://localhost:8000/health
Swagger → http://localhost:8000/docs

## Tuzilma

```
app/
  core/      config, security (JWT + initData HMAC), barcode (Code-128 PDF), enums, errors
  db/        base (async engine), models (10 jadval)
  schemas/   Pydantic request/response (kontrakt)
  api/v1/    endpoints (auth, carrier, warehouse_uz, courier_uz, courier_tr, warehouse_tr, admin, labels)
  services/  order, custody, barcode, payment, auth, counter
  bot/       instance, handlers (/start WebApp), runner (polling), notify
  seed.py    dev test ma'lumotlari
```

## Migration

```bash
docker compose exec backend alembic upgrade head
docker compose exec backend alembic revision --autogenerate -m "name"
```

## Muhim invariantlar

- **Barkod**: ALB-NNNNNN ketma-ket (counters jadvali, atomik)
- **Custody**: bir egada, har scan custody_events ga (APPEND ONLY trigger)
- **Narx**: order_item.locked_cargo_price — pick paytida qulflanadi
- **Firewall**: carrier box_weight_kg / ichki narx ko'rmaydi
- **initData**: Telegram HMAC server tomonda tekshiriladi (dev: `dev:{...}` bypass)
- **Pul**: Decimal (Numeric 18,4), API'da butun so'm
