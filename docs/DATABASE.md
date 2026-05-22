# ALI BRIDGE — Database Sxemasi

## Texnologiya
- **PostgreSQL 16** — asosiy ma'lumotlar bazasi
- **UUID v4** — barcha jadvallar uchun primary key
- **TIMESTAMPTZ** — barcha vaqt maydonlari (UTC)
- **SQLAlchemy 2.0 async** — ORM

---

## Jadvallar

### `users`
Telegram foydalanuvchilari.

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | UUID PK | Ichki ID |
| telegram_id | BIGINT UNIQUE | Telegram user ID |
| full_name | VARCHAR(255) | To'liq ism |
| username | VARCHAR(100) | @username (opsional) |
| language | ENUM | uz/ru/tr/en |
| is_active | BOOLEAN | Faollik holati |
| created_at | TIMESTAMPTZ | Yaratilgan vaqt |

### `user_roles`
Foydalanuvchi rollari (ko'p-ko'p).

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| role | ENUM | orderer/carrier/warehouse_uz/... |
| granted_by | UUID FK → users | Kim berdi |
| granted_at | TIMESTAMPTZ | Qachon |

**Unique:** (user_id, role)

### `walk_in_customers`
Ro'yxatdan o'tmagan buyurtmachilar.

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | UUID PK | |
| name | VARCHAR(255) | |
| phone | VARCHAR(20) | |
| created_by | UUID FK → users | |
| created_at | TIMESTAMPTZ | |

---

### `sourcing_specs`
Mahsulot spesifikatsiyalari (buyurtmachi kiritgan).

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | UUID PK | |
| title | VARCHAR(500) | Mahsulot nomi |
| photos | TEXT[] | S3 URL'lar |
| unit_weight_g | INTEGER | Og'irlik (gram) |
| color | VARCHAR(100) | Rang (opsional) |
| notes | TEXT | Izoh |
| created_at | TIMESTAMPTZ | |

**Index:** GIN trigram (title) — tezkor qidirish uchun

### `orders`
Buyurtmalar.

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | UUID PK | |
| order_number | VARCHAR(20) UNIQUE | Inson o'qiydigan raqam |
| orderer_id | UUID FK → users | NULL agar walk-in |
| walk_in_customer_id | UUID FK → walk_in_customers | NULL agar registered |
| source | ENUM | SELF/WALK_IN |
| status | ENUM | DRAFT/CONFIRMED/... |
| destination_city | VARCHAR(100) | |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | |

**Constraint:** CHECK (orderer_id IS NOT NULL) XOR (walk_in_customer_id IS NOT NULL)

### `order_lines`
Buyurtma qatorlari.

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | UUID PK | |
| order_id | UUID FK → orders | |
| spec_id | UUID FK → sourcing_specs | |
| quantity | INTEGER | So'ralgan miqdor |
| unit_weight_g | INTEGER | |
| count_received | INTEGER DEFAULT 0 | Qabul qilingan (intake'dan) |

---

### `products`
Mahsulot pasporti — har bir fizik mahsulot.

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | UUID PK | |
| spec_id | UUID FK → sourcing_specs | |
| order_id | UUID FK → orders | |
| short_code | CHAR(8) UNIQUE | QR etiketa (insoncha o'qiladigan) |
| qr_payload | TEXT UNIQUE | HMAC-signed QR kontent |
| barcode_payload | TEXT | 1D barkod |
| status | ENUM | ProductStatus |
| custody_holder_type | ENUM | HolderType (denormalized cache) |
| custody_holder_id | UUID | Kim ushlamoqda |
| label_printed_at | TIMESTAMPTZ | So'nggi chop etish |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Index:** short_code, custody_holder_type+custody_holder_id

---

### `custody_events` ⚠️ APPEND-ONLY
Egalik zanjiri — hech qachon o'zgartirilmaydi.

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | UUID PK | |
| product_id | UUID FK → products | |
| event_type | ENUM | CustodyEventType |
| from_holder_type | ENUM | Oldingi ega turi |
| from_holder_id | UUID | Oldingi ega ID |
| to_holder_type | ENUM | Yangi ega turi |
| to_holder_id | UUID | Yangi ega ID |
| actor_id | UUID FK → users | Kim amalga oshirdi |
| session_id | UUID | UI grouping (atomic emas!) |
| seal_number | VARCHAR(50) | Muhr raqami (ixtiyoriy) |
| handoff_code | CHAR(6) | 6-xonali tasdiqlash kodi |
| created_at | TIMESTAMPTZ | |

**Triggers:** `UPDATE` va `DELETE` taqiqlangan (PostgreSQL trigger)  
**Index:** product_id, (actor_id, created_at)

---

### `carrier_profiles`
Carrier ro'yxatdan o'tish ma'lumotlari.

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | UUID PK | |
| user_id | UUID FK → users UNIQUE | |
| passport_s3_key | TEXT | Passport rasmi |
| selfie_s3_key | TEXT | Selfie rasmi |
| ticket_s3_key | TEXT | Aviabilet rasmi |
| passport_name | VARCHAR(255) | OCR dan |
| passport_number | VARCHAR(50) | |
| passport_expiry | DATE | |
| trust_tier | ENUM | NEW/TRUSTED/VERIFIED/VIP |
| kg_limit | INTEGER DEFAULT 5000 | Gram |
| total_trips | INTEGER DEFAULT 0 | |
| total_delivered | INTEGER DEFAULT 0 | |
| is_active | BOOLEAN DEFAULT FALSE | Invariant 5: dual confirm |
| liability_consented_at | TIMESTAMPTZ | |
| onboarding_channel | ENUM | TELEGRAM/WEB |

### `routes`
Parvoz marshrutlari.

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | UUID PK | |
| carrier_id | UUID FK → carrier_profiles | |
| origin | VARCHAR(10) | IATA kodi |
| destination | VARCHAR(10) | IATA kodi |
| departure_date | DATE | |
| flight_number | VARCHAR(20) | |

### `carrier_picks`
Carrier tanlov (savat → tasdiqlangan).

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | UUID PK | |
| carrier_id | UUID FK → carrier_profiles | |
| product_id | UUID FK → products UNIQUE | **Invariant 1**: bitta ega |
| route_id | UUID FK → routes | |
| locked_cargo_price | DECIMAL(18,4) | **Invariant 3**: lock qilingan narx |
| locked_currency | VARCHAR(10) | |
| locked_weight_g | INTEGER | |
| basket_lock_until | TIMESTAMPTZ | 20-daqiqa TTL |
| payout_id | UUID FK → payouts | |
| deduction_amount | DECIMAL(18,4) | Dispute natijasi |
| picked_at | TIMESTAMPTZ | |
| delivered_at | TIMESTAMPTZ | |

---

### `payouts`
Carrier to'lovlari.

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | UUID PK | |
| carrier_id | UUID FK → carrier_profiles | |
| payout_method | ENUM | CARD_UZ/CARD_TR/CRYPTO_USDT/CASH |
| account_details | TEXT (encrypted) | Hisob raqami |
| gross_amount | DECIMAL(18,4) | |
| deductions | DECIMAL(18,4) | Disputlardan |
| net_amount | DECIMAL(18,4) | |
| currency | VARCHAR(10) | |
| fx_rate_to_usd | DECIMAL(18,6) | So'rov vaqtidagi kurs |
| status | ENUM | REQUESTED/APPROVED/PAID/REJECTED |
| rejection_reason | TEXT | |
| paid_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

### `payout_lines`
To'lovga kiritilgan pick'lar.

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | UUID PK | |
| payout_id | UUID FK → payouts | |
| pick_id | UUID FK → carrier_picks | |

---

### `disputes`
Da'volar va nizolar.

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | UUID PK | |
| product_id | UUID FK → products | |
| pick_id | UUID FK → carrier_picks | |
| filed_by_user_id | UUID FK → users | |
| dispute_type | ENUM | MISSING/DAMAGED/WRONG_ITEM/CUSTOMS_SEIZED |
| status | ENUM | OPEN/INVESTIGATING/RESOLVED |
| description | TEXT | |
| resolution | ENUM | CARRIER_FAULT/FORCE_MAJEURE/... |
| deduction_amount | DECIMAL(18,4) | |
| resolved_by_user_id | UUID FK → users | |
| resolution_notes | TEXT | |
| resolved_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

**Partial index:** (status) WHERE status != 'RESOLVED' — tezkor ochiq da'volar

---

### `audit_log` ⚠️ APPEND-ONLY
Barcha muhim operatsiyalar.

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | UUID PK | |
| actor_id | UUID FK → users | |
| action | VARCHAR(100) | |
| resource_type | VARCHAR(50) | |
| resource_id | UUID | |
| changes | JSONB | |
| ip_address | INET | |
| success | BOOLEAN | |
| error_message | TEXT | |
| created_at | TIMESTAMPTZ | |

**Trigger:** `UPDATE` va `DELETE` taqiqlangan  
**Retention:** 3 yil (cron job)

---

## Muhim invariantlar

### 1. Custody append-only
```sql
-- PostgreSQL trigger
BEFORE UPDATE OR DELETE ON custody_events
RAISE EXCEPTION 'append-only table';
```

### 2. Bitta ega (UNIQUE)
```sql
-- carrier_picks jadvalida
product_id UUID UNIQUE NOT NULL
```

### 3. Narx lock
```sql
-- carrier_picks jadvalida
locked_cargo_price DECIMAL(18,4) NOT NULL
-- Hech qachon o'zgartirilmaydi
```

### 4. XOR constraint
```sql
-- orders jadvalida
CHECK (
  (orderer_id IS NOT NULL AND walk_in_customer_id IS NULL) OR
  (orderer_id IS NULL AND walk_in_customer_id IS NOT NULL)
)
```

---

## Migration ishlatish

```bash
# Alembic bilan yangi migration
docker-compose exec backend alembic revision --autogenerate -m "description"

# Migratsiyani qo'llash
docker-compose exec backend alembic upgrade head

# Holatni ko'rish
docker-compose exec backend alembic current
docker-compose exec backend alembic history

# DB triggers (migration'dan keyin)
docker-compose exec backend python scripts/init_db.py
```
