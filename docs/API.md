# ALI BRIDGE — API Dokumentatsiyasi

Base URL: `https://YOUR_DOMAIN/api/v1`

Barcha so'rovlar `Authorization: Bearer <JWT>` header talab qiladi  
(auth endpoint bundan mustasno).

---

## Auth

### POST /auth/telegram
Telegram initData → JWT

**Request:**
```json
{
  "init_data": "query_id=...&user=...&hash=..."
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "telegram_id": "123456789",
    "full_name": "John Doe",
    "username": "johndoe",
    "language": "uz",
    "roles": ["carrier"]
  }
}
```

---

## Catalog (Carrier)

### GET /catalog
Carrier uchun filtrlangan mahsulot katalogi.  
**Role:** carrier  
**Query params:** `page`, `page_size`, `search`

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "short_code": "AB1234CD",
      "spec_title": "iPhone 15 Pro 256GB",
      "spec_photos": ["https://s3.../photo.jpg"],
      "unit_weight_g": 221,
      "color": "Natural",
      "cargo_price": "45.00",
      "cargo_currency": "USD",
      "value_tier": "LUXURY"
    }
  ],
  "total": 42,
  "available_weight_g": 8000
}
```

---

## Basket

### GET /basket
Carrier savati.  
**Role:** carrier

### POST /basket/add
Mahsulotni savatga qo'shish (SELECT FOR UPDATE — Invariant 1).  
**Role:** carrier

**Request:**
```json
{ "product_id": "uuid" }
```

### DELETE /basket/{pick_id}
Savatdan olib tashlash.  
**Role:** carrier

---

## Orders

### GET /orders
Buyurtmalar ro'yxati.  
**Role:** orderer

### POST /orders
Yangi buyurtma.  
**Role:** orderer

**Request:**
```json
{
  "source": "SELF",
  "destination_city": "Istanbul",
  "lines": [
    {
      "name": "iPhone 15 Pro",
      "quantity": 2,
      "unit_weight_g": 221
    }
  ],
  "notes": "Ehtiyotkorlik bilan"
}
```

### GET /orders/summary
Statistika (total, in_transit, delivered).  
**Role:** orderer

### GET /orders/{order_id}
Buyurtma detali + mahsulot kuzatuvi.  
**Role:** orderer

---

## Scan

### POST /scan
Mahsulotni skanerlash — bitta atomic tranzaksiya (Invariant 4).  
**Role:** carrier, warehouse_uz, warehouse_tr, courier_uz, courier_tr

**Request:**
```json
{
  "qr_payload": "base64url_signed_payload",
  "context": "WAREHOUSE_UZ_IN"
}
```

**Response:**
```json
{
  "product_id": "uuid",
  "short_code": "AB1234CD",
  "prev_holder_type": "CARRIER",
  "new_holder_type": "WAREHOUSE_UZ",
  "event_id": "uuid"
}
```

**Errors:**
- `400 INVALID_QR` — HMAC tekshiruvi muvaffaqiyatsiz
- `409 INVALID_TRANSITION` — Custody State Machine: ruxsat yo'q o'tish

---

## Profile

### GET /profile/me
Foydalanuvchi profili.  
**Role:** barcha

### PATCH /profile/language
Tilni o'zgartirish.

**Request:**
```json
{ "language": "ru" }
```

---

## Carrier

### GET /carrier/picks
Carrier olgan mahsulotlar tarixi.  
**Role:** carrier

---

## Payouts

### GET /payouts
To'lovlar tarixi.  
**Role:** carrier

### POST /payouts/request
To'lov so'rovi.  
**Role:** carrier

**Request:**
```json
{
  "payout_method": "CARD_UZ",
  "account_details": "8600 1234 5678 9012",
  "pick_ids": ["uuid1", "uuid2"],
  "currency": "USD"
}
```

---

## Uploads

### POST /uploads/passport
Passport rasmi yuklash.  
**Role:** carrier  
**Content-Type:** multipart/form-data

### POST /uploads/ticket
Aviabilet rasmi yuklash.  
**Role:** carrier  
**Content-Type:** multipart/form-data

---

## Warehouse UZ

### GET /warehouse/uz/stats
Statistika.  
**Role:** warehouse_uz

### GET /warehouse/uz/intake/pending
Kutayotgan jo'natmalar.  
**Role:** warehouse_uz

### POST /warehouse/uz/intake
Buyurtma qabul qilish.  
**Role:** warehouse_uz

**Request:**
```json
{
  "order_id": "uuid",
  "lines": [
    { "line_id": "uuid", "count_received": 2 }
  ]
}
```

### GET /warehouse/uz/labels/pending
Chop etish kutayotgan etiketlar.  
**Role:** warehouse_uz

### POST /warehouse/uz/labels/print/{order_id}
PDF generatsiya va chop etish.  
**Role:** warehouse_uz

---

## Warehouse TR

### GET /warehouse/tr/stats
Statistika.  
**Role:** warehouse_tr

### GET /warehouse/tr/ready
Yetkazib berish uchun tayyor mahsulotlar.  
**Role:** warehouse_tr

### POST /warehouse/tr/handoff
Kurye'ga topshirish.  
**Role:** warehouse_tr

**Request:**
```json
{
  "product_ids": ["uuid1", "uuid2"],
  "courier_id": "uuid",
  "handoff_code": "123456"
}
```

---

## China

### GET /china/tickets
Sourcing talonlar (Invariant 2: orderer_id yo'q).  
**Role:** china_worker

---

## Courier

### GET /courier/stats
Statistika.  
**Role:** courier_uz, courier_tr

### GET /courier/queue
Yetkazib berish navbati.  
**Role:** courier_uz, courier_tr

### POST /courier/deliver/{product_id}
Yetkazilgan deb belgilash.  
**Role:** courier_uz, courier_tr

---

## Admin

### GET /admin/stats
Tizim statistikasi.  
**Role:** admin

### GET /admin/users
Foydalanuvchilar ro'yxati.  
**Role:** admin  
**Query:** `q` (search)

### POST /admin/users/{user_id}/roles
Rol berish.  
**Role:** admin

**Request:**
```json
{ "role": "carrier" }
```

### DELETE /admin/users/{user_id}/roles/{role}
Rolni olib tashlash.  
**Role:** admin

### GET /admin/disputes
Da'volar ro'yxati.  
**Role:** admin  
**Query:** `status=OPEN|INVESTIGATING|RESOLVED`

### POST /admin/disputes/{dispute_id}/resolve
Da'voni hal qilish.  
**Role:** admin

**Request:**
```json
{
  "resolution": "CARRIER_FAULT",
  "deduction_amount": "25.00",
  "notes": "Carrier javobgar"
}
```

### GET /admin/payouts
To'lov so'rovlari.  
**Role:** admin  
**Query:** `status=REQUESTED|PAID|REJECTED`

### POST /admin/payouts/{payout_id}/approve
To'lovni tasdiqlash.  
**Role:** admin

### POST /admin/payouts/{payout_id}/reject
To'lovni rad etish.  
**Role:** admin

---

## Telegram Webhook

### POST /telegram/webhook
Telegram bot webhook (faqat Telegram serverlaridan).

---

## Xato kodlari

| HTTP | Code | Tavsif |
|------|------|--------|
| 400 | INVALID_QR | QR HMAC tekshiruvi muvaffaqiyatsiz |
| 400 | PRODUCT_LOCKED | Mahsulot allaqachon boshqa carrier'da |
| 400 | INVALID_TRANSITION | Custody state o'tishi taqiqlangan |
| 401 | UNAUTHORIZED | Token yo'q yoki eskirgan |
| 403 | FORBIDDEN | Bu rol uchun ruxsat yo'q |
| 404 | NOT_FOUND | Resurs topilmadi |
| 409 | CONFLICT | Ma'lumotlar ziddiyati |
| 422 | VALIDATION_ERROR | Kiritilgan ma'lumotlar noto'g'ri |
| 500 | INTERNAL_ERROR | Server xatosi |
