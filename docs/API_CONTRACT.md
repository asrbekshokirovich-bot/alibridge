# ALI BRIDGE — API Shartnomasi (Kontrakt)

> Frontend kutadigan barcha endpointlar. Backend AYNAN shu shaklda javob qaytarishi shart.
> Base URL: `/api/v1` · Auth: `Authorization: Bearer <JWT>` (register'dan tashqari)

## Umumiy qoidalar

- **Xato javobi** (barcha endpointlar uchun bir xil):
  ```json
  { "error": { "code": "STRING", "message": "O'zbekcha xabar", "details": {} } }
  ```
- **Pul**: butun son, so'mda (masalan `450000`)
- **Sana**: `YYYY-MM-DD` (string)
- **401** qaytsa → frontend tokenni o'chiradi va logout qiladi
- **Barkod**: string, format `ALB-NNNNNN` (prefiks `ALB-` + 6 raqamli ketma-ket son, masalan `ALB-100001`). Code-128 shtrix-kod sifatida chop etiladi.
  - **1 kategoriya = 1 barkod.** Masalan 200 dona krasovka kiritilsa, tizim BITTA `ALB-100001` yaratadi; skladchi shu kodni printerda 200 marta chiqarib har bir donaga yopishtiradi. Hamma 200 dona bir xil barkodga ega.

---

## 1. AUTH

### `POST /auth/register`
Ro'yxatdan o'tish (yo'lovchi, buyurtmachi, xodim).

**Kirish:**
```json
{
  "first_name": "Sardor",
  "last_name": "Aliyev",
  "phone": "+998901234567",
  "passport": "AB1234567",
  "reg_type": "carrier",        // "carrier" | "orderer" | "staff"
  "tg_init_data": "<telegram initData string>"
}
```

**Chiqish (200):**
```json
{
  "token": "<JWT>",
  "user": {
    "id": 1,
    "telegram_id": 123456789,
    "first_name": "Sardor",
    "last_name": "Aliyev",
    "phone": "+998901234567",
    "role": "carrier",          // staff bo'lsa hали rol yo'q — pastga qarang
    "carrier_number": 47,        // faqat carrier uchun, aks holda null
    "is_active": true
  }
}
```

**Muhim mantiq:**
- `reg_type=carrier` → `role=carrier`, sequential `carrier_number` beriladi (1, 2, 3...)
- `reg_type=orderer` → `role=orderer`
- `reg_type=staff` → admin tasdiqlaguncha rol berilmaydi. Bu holatda:
  - `is_active: false` qaytariladi (yoki maxsus `role: "pending"`)
  - Frontend `/staff/pending` ekraniga yo'naltiradi
  - Admin tasdiqlagach (pastga qarang) rol beriladi
- `tg_init_data` Telegram HMAC bilan **server tomonda tekshirilishi shart**

---

## 2. CARRIER (Yo'lovchi)

### `GET /products/catalog?max_weight=<kg>`
Katalog — yo'lovchi olib keta oladigan mahsulotlar (kg limitiga mos).

**Query:** `max_weight` (ixtiyoriy) — yo'lovchining kg limiti. Backend shundan og'ir bo'lmagan mahsulotlarni qaytaradi.

**Chiqish (200):** `Product[]`
```json
[
  {
    "id": 1,
    "barcode": "KRS-001",
    "name": "Krasovka Nike",
    "category": "Poyabzal",
    "type": "piece",            // "piece" (donali) | "weight" (kiloli/tekstil)
    "quantity": 600,             // mavjud jami dona
    "weight_kg": 480,            // mavjud jami kg
    "unit_weight_kg": 0.8,       // 1 dona vazni (donali uchun; kiloli'da null)
    "box_weight_kg": null,       // kartonka vazni (kiloli uchun; carrier ko'rmaydi → null yuboring)
    "cargo_price": 50000,        // donali: 1 dona narxi | kiloli: 1 kg narxi
    "status": "in_warehouse_uz",
    "image_url": null            // mahsulot rasmi (ixtiyoriy)
  }
]
```
> **Firewall:** carrier'ga `box_weight_kg` yuborilmasin (null). Ichki narxlar ham yo'q.

### `POST /carrier/orders`
Yangi buyurtma yaratish (savatni tasdiqlash).

**Kirish:**
```json
{
  "items": [
    { "product_id": 1, "amount": 5 },     // donali: amount = dona soni
    { "product_id": 2, "amount": 10 }      // kiloli: amount = kg
  ],
  "pickup_type": "self",                   // "self" (o'zi oladi) | "courier" (kuryer keladi)
  "pickup_address": null,                  // courier bo'lsa Toshkent manzili, aks holda null
  "delivery_address_tr": "Istanbul, Fatih, ..."  // Turkiyadagi yetkazish manzili
}
```

**Chiqish (200):** `{ "ok": true, "order_id": 101 }`

**Muhim mantiq:**
- Buyurtma `status: pending_admin` bilan yaratiladi
- Kiloli mahsulot uchun `amount` (kg) saqlanadi, dona keyin ombor tomonidan aniqlanadi
- Admin va Toshkent omboriga bildirishnoma ketadi (bot)

### `GET /carrier/orders`
Yo'lovchining o'z buyurtmalari.

**Chiqish (200):** `CarrierOrder[]`
```json
[
  {
    "id": 101,
    "carrier_id": 1,
    "products": [ /* Product[] — yuqoridagi shakl */ ],
    "pickup_type": "self",
    "pickup_address": null,
    "delivery_address_tr": "Istanbul...",
    "status": "pending_admin",
    "created_at": "2026-06-01"
  }
]
```
**Status qiymatlari:** `pending_admin` → `confirmed` → `in_warehouse_uz` → `with_carrier` → `delivered_tr` · (`damaged` — alohida)

### `GET /couriers/uz/active`
Aeroportda faol Toshkent kuryerlari (yo'lovchi qabul qilish uchun).

**Chiqish (200):**
```json
[ { "id": 1, "first_name": "Aziz", "last_name": "Karimov" } ]
```

### `POST /carrier/auto-receive`
Yo'lovchi aeroportda kuryerni tanlaydi (kuryer keyin barkod skanlaydi).

**Kirish:** `{ "courier_id": 1 }`
**Chiqish (200):** `{ "ok": true }`

---

## 3. WAREHOUSE UZ (Toshkent ombori)

### `GET /warehouse-uz/stats`
**Chiqish (200):**
```json
{ "pending_receive": 3, "in_warehouse": 12, "pending_handover": 2 }
```

### `POST /warehouse-uz/receive`
Xitoydan kelgan yukni qabul qilish (qo'lda kiritish → barkod generatsiya).

**Kirish:**
```json
{
  "name": "Krasovka Nike",
  "category": "Poyabzal",
  "type": "piece",              // "piece" | "weight"
  "quantity": 600,              // dona soni
  "weight_kg": null,            // kiloli bo'lsa jami kg, aks holda null
  "box_weight_kg": null,        // kiloli bo'lsa kartonka vazni (ixtiyoriy)
  "cargo_price": 50000
}
```

**Chiqish (200):**
```json
{
  "barcode": "ALB-100001",      // generatsiya qilingan barkod (ALB-NNNNNN)
  "name": "Krasovka Nike",      // yorliqда ko'rsatiladigan nom
  "received_date": "2026-06-06",// qabul qilingan sana (avtomatik = bugun)
  "print_url": "https://.../labels/ALB-100001.pdf",  // PDF yorliq (brauzerdan yuklanadi)
  "quantity": 600               // necha nusxa chop etish kerak
}
```
> Bitta lotga **bitta barkod**, `quantity` marta chop etiladi.
>
> **PDF yorliq dizayni** (backend generatsiya qiladi, har nusxa shunday):
> ```
> ┌──────────────────────┐
> │  Krasovka Nike       │  ← name (tepada)
> │  06.06.2026          │  ← received_date
> │  ║║│║║││║║│║║││║║│    │  ← Code-128 shtrix-kod
> │  ALB-100001          │  ← barcode kod
> └──────────────────────┘
> ```
> Frontend "Barkod chiqarish" tugmasi `print_url` (PDF) ni yangi oynada ochadi/yuklaydi.

### `GET /warehouse-uz/pending-weigh`
Yo'lovchilar so'ragan kiloli yuklar (tortish kerak).

**Chiqish (200):**
```json
[
  {
    "order_id": 1,
    "carrier_name": "Sardor Aliyev",
    "carrier_number": 47,
    "product_name": "Tekstil mato",
    "requested_kg": 10
  }
]
```

### `POST /warehouse-uz/confirm-weigh`
Tortib, dona sonini kiritish → barkod.

**Kirish:** `{ "order_id": 1, "actual_quantity": 4 }`
**Chiqish (200):**
```json
{
  "order_id": 1,
  "actual_quantity": 4,
  "actual_kg": 10,
  "barcode": "TEX-001",
  "print_url": "https://..."
}
```

### Skanlash (yo'lovchiga/kuryerga topshirish)
Quyidagi juftliklar bir xil ishlaydi — **scan** (har barkod) + **confirm** (yakuniy).

| Maqsad | scan endpoint | confirm endpoint |
|--------|---------------|------------------|
| Yo'lovchiga topshirish | `POST /warehouse-uz/scan-for-carrier` | `POST /warehouse-uz/confirm-carrier-handover` |
| Toshkent kuryeriga topshirish | `POST /warehouse-uz/scan-for-courier` | `POST /warehouse-uz/confirm-courier-handover` |

**scan kirish:** `{ "barcode": "KRS-001" }`
**scan chiqish (200):**
```json
{
  "barcode": "KRS-001",
  "product_name": "Krasovka Nike",
  "carrier_name": "Sardor Aliyev",   // scan-for-carrier uchun (ixtiyoriy)
  "carrier_number": 47,               // scan-for-carrier uchun (ixtiyoriy)
  "quantity": 5
}
```
> Agar barkod noto'g'ri/topshirib bo'lingan bo'lsa → `400` xato (frontend ko'rsatadi).

**confirm kirish:** `{ "barcodes": ["KRS-001", "KRS-002"] }`
**confirm chiqish (200):** `{ "ok": true }`

---

## 4. COURIER UZ (Toshkent kuryeri)

### `GET /courier-uz/queue`
Yetkazish navbati (yo'lovchilardan olish).

**Chiqish (200):**
```json
[
  {
    "id": 1,
    "carrier_name": "Sardor Aliyev",
    "carrier_number": 47,
    "address": "Chilonzor 5-uy",
    "products_count": 3,
    "status": "pending"          // "pending" | "in_progress" | "done"
  }
]
```

### Ombordan olish (mustaqil)
- **scan:** `POST /courier-uz/scan-pickup` → `{ barcode }` → `{ barcode, product_name }`
- **confirm:** `POST /courier-uz/confirm-pickup` → `{ barcodes: [] }` → `{ ok: true }`

### Aeroportda yo'lovchiga topshirish
- **scan:** `POST /courier-uz/scan-airport` → `{ barcode, carrier_number }` → `{ barcode, product_name, carrier_name, carrier_number }`
- **confirm:** `POST /courier-uz/confirm-airport` → `{ carrier_number, barcodes: [] }` → `{ ok: true }`
> `carrier_number` (int) — yo'lovchining tartib raqami.

---

## 5. COURIER TR (Turkiya kuryeri)

### O'zbekistondan kelgan yuklarni qabul
- **scan:** `POST /courier-tr/scan-receive` → `{ barcode }` → `{ barcode, product_name, carrier_name, carrier_number }`
- **confirm:** `POST /courier-tr/confirm-receive` → `{ barcodes: [] }` → `{ ok: true }`

### Shikastlangan yuk qayd etish
### `POST /courier-tr/report-damaged`
**Kirish:** `{ "carrier_number": 47, "barcode": "KRS-001", "note": "Quti ezilgan" }`
**Chiqish (200):** `{ "ok": true }`
> Admin va Turkiya ombori panelida ko'rinadi. Yo'lovchi panelida ham "zarar yetgan" bo'lib chiqadi.

### Yetkazish (buyurtmachiga)
### `GET /courier-tr/deliveries`
**Chiqish (200):**
```json
[
  {
    "id": 1,
    "address": "Istanbul, Fatih mah. ...",
    "recipient_name": "Murod",
    "products_count": 2
  }
]
```
- **scan:** `POST /courier-tr/scan-delivery` → `{ barcode, delivery_id }` → `{ barcode, product_name }`
- **confirm:** `POST /courier-tr/confirm-delivery` → `{ delivery_id, barcodes: [] }` → `{ ok: true }`

---

## 6. WAREHOUSE TR (Turkiya ombori)

### Yo'lovchidan qabul
- **scan:** `POST /warehouse-tr/scan-receive` → `{ barcode }` → `{ barcode, product_name, carrier_name }`
- **confirm:** `POST /warehouse-tr/confirm-receive` → `{ barcodes: [] }` → `{ ok: true }`

### Kuryerga topshirish
- **scan:** `POST /warehouse-tr/scan-handover` → `{ barcode }` → `{ barcode, product_name }`
- **confirm:** `POST /warehouse-tr/confirm-handover` → `{ barcodes: [] }` → `{ ok: true }`

### `POST /warehouse-tr/walk-in`
Telegramsiz mijoz qo'shish.
**Kirish:** `{ "name": "...", "phone": "+90...", "note": "..." }`
**Chiqish (200):** `{ "ok": true }`

### `GET /warehouse-tr/uz-products`
Toshkent omboridagi mahsulotlar (read-only kuzatuv).
**Chiqish (200):** `Product[]` (yuqoridagi shakl, lekin bu yerda `box_weight_kg` **ko'rsatiladi** — wh_tr ko'ra oladi).

---

## 7. ADMIN

### `GET /admin/stats`
```json
{ "pending_staff": 2, "active_carriers": 15, "total_products": 340, "open_disputes": 1, "unpaid_payments": 4 }
```

### `GET /admin/staff-requests`
Rol kutayotgan xodimlar.
```json
[ { "id": 1, "first_name": "Jasur", "last_name": "Toshmatov", "phone": "+998...", "created_at": "2026-06-05" } ]
```

### `POST /admin/staff-requests/:id/approve`
**Kirish:** `{ "role": "warehouse_uz" }`  (role: warehouse_uz|warehouse_tr|courier_uz|courier_tr|china_worker)
**Chiqish (200):** `{ "ok": true }`
> Xodimga bot orqali "tasdiqlandi" xabari + rol beriladi.

### `POST /admin/staff-requests/:id/reject`
**Chiqish (200):** `{ "ok": true }`

### `GET /admin/carriers`
```json
[
  {
    "id": 1, "first_name": "Sardor", "last_name": "Aliyev",
    "phone": "+998...", "carrier_number": 47,
    "is_active": true, "total_trips": 12
  }
]
```

### `GET /admin/disputes`
```json
[
  {
    "id": 1, "product_name": "Krasovka", "barcode": "KRS-001",
    "carrier_name": "Sardor", "carrier_number": 47,
    "note": "Quti ezilgan", "status": "open",   // "open" | "resolved" | "rejected"
    "created_at": "2026-06-04"
  }
]
```

### `POST /admin/disputes/:id/update`
**Kirish:** `{ "status": "resolved" }`  ("resolved" | "rejected")
**Chiqish (200):** `{ "ok": true }`

### `GET /admin/payments`
Yo'lovchilarga to'lov hisoboti (yuk tashilgandan keyin avto-hisoblanadi).
```json
[
  {
    "id": 1, "carrier_name": "Sardor Aliyev", "carrier_number": 47,
    "products_count": 3, "total_amount": 450000, "status": "unpaid"  // "unpaid" | "paid"
  }
]
```

### `POST /admin/payments/:id/mark-paid`
**Chiqish (200):** `{ "ok": true }`

---

## Status oqimi (umumiy)

```
Mahsulot:  in_warehouse_uz → (yo'lovchi tanladi) pending_admin
           → (admin) confirmed → (ombor topshirdi) with_carrier
           → (TR kuryer qabul) delivered_tr
           [istalgan vaqtda] → damaged

Xodim:     register(staff) → pending → (admin approve) role berildi
Buyurtma:  pending_admin → confirmed → with_carrier → delivered_tr
```

## Hали qurilmagan (keyin)
- `orderer` (buyurtmachi) endpointlari
- `china_worker` (Xitoy ishchisi) endpointlari
- Bot bildirishnomalari (server tomonда aiogram orqali)
