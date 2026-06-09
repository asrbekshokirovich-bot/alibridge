# REJA — Rasmli yuk + Uzum uslubidagi katalog

> Maqsad: ombor xodimi yukni **kamera bilan suratga olib** kiritadi (rasm majburiy),
> yo'lovchi katalogi **Uzum Market uslubida** (rasm → tag → narx → Tanlash/− son +).

## Tanlangan variantlar
- 📷 Rasm: faqat **kamera bilan suratga olish** (`capture="environment"`)
- ☁️ Saqlash: **Supabase Storage** (bucket: `product-images`, public)
- ✅ Rasm: ombor xodimiga **majburiy**
- ➕➖ Miqdor: donali ham, kiloli/tekstil ham **+ / −** (1 dona / 1 kg qadam)

---

## ✅ BAJARILGAN (kod yozilgan, lekin hali QURILMAGAN)

### Supabase sozlamasi (tugatilgan)
- `product-images` public bucket yaratildi
- S3 kalit olindi, `.env` ga yozildi:
  - `S3_ENDPOINT=https://wiqjhquaojlrtgnkpcdi.storage.supabase.co/storage/v1/s3`
  - `S3_REGION=eu-central-1`, `S3_BUCKET=product-images`, `S3_USE_SSL=true`
  - `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_PUBLIC_URL` to'ldirilgan
- ⚠️ Kalitlar chatda yuborilgan — keyin Supabase'da kalitni almashtirish (rotate) tavsiya etiladi

### Backend (kod yozilgan + S3 ulanish TEST QILINGAN, ishladi)
- `requirements.txt` → `boto3==1.35.99` qo'shildi (image qayta qurilgan, o'rnatilgan)
- `app/core/config.py` → S3 sozlamalari + `s3_enabled` property
- `app/services/storage_service.py` → YANGI: rasmni Pillow bilan siqib (maks 1280px, JPEG q82),
  boto3 orqali Supabase'ga yuklaydi, public URL qaytaradi
- `app/api/v1/endpoints/warehouse_uz.py` → YANGI endpoint:
  `POST /warehouse-uz/products/{id}/image` (UploadFile, maks 10MB, jpg/png/webp/heic)
- ✅ Test: rasm yuklandi, public URL HTTP 200 / image/jpeg qaytardi, test fayl o'chirildi

### Frontend (kod yozilgan, type-check XATOSIZ o'tgan, hali build qilinmagan)
- `features/warehouse_uz/components/ProductDetailsForm.tsx`:
  - Kamera tugmasi (`accept="image/*" capture="environment"`)
  - Rasm preview + "Yuklanmoqda…" holati
  - `valid` ga `imageUrl` sharti qo'shildi → rasmsiz "Qabul qilish" bloklangan
- `features/carrier/pages/Products.tsx` — TO'LIQ qayta yozildi (Uzum uslubi):
  - 2 ustunli grid
  - Har karta: rasm → tag (Donali/Kiloli/Tekstil) → narx (/dona yoki /kg) → mavjud miqdor
  - "Tanlash" tugmasi → bosilganda `− [son] +` ga aylanadi (inline, Sheet yo'q)
  - Donali: 1,2,3… | Kiloli/Tekstil: 1,2,3 kg… | maksimaldan oshmaydi | 0 da Tanlashga qaytadi
  - Eski Sheet (miqdor kiritish oynasi) olib tashlandi

---

## ⏳ QILINISHI KERAK (keyingi safar)

### 1. Build qilish (asosiy qolgan ish)
```bash
cd "Telegram Mini App"
docker compose build frontend && docker compose up -d frontend
```
Backend allaqachon qurilgan va ishlab turibdi. Faqat **frontend build** kerak.

### 2. Real qurilmada test
- Ombor paneli → Yuk qabul qilish → 1-qadam (nom) → 2-qadam: **kamera ochiladimi**, rasm yuklanadimi, preview ko'rinadimi
- Rasmsiz "Qabul qilish" bloklanganini tekshirish
- Yo'lovchi → Mahsulotlar → grid ko'rinishi, rasm chiqishi, Tanlash → +/− ishlashi
- Kiloli/tekstil uchun +/− kg qadami to'g'rimi

### 3. Kichik tuzatishlar (test natijasiga qarab)
- Kiloli/tekstil uchun +/− 1 kg qadam yetarlimi yoki 0.5 kg kerakmi (hozir 1 kg)
- Eski mahsulotlarda rasm yo'q (`image_url=null`) → katalogda emoji ko'rinadi (fallback bor)

---

## 🔮 KEYINGI BOSQICH (ixtiyoriy, hozir emas)
- **Eski rasmlarni avto-tozalash**: yuk DELIVERED bo'lgach, masalan 3 oydan keyin rasmni Supabase'dan o'chirish (joy to'lmasligi uchun). 100GB ≈ 200k rasm — shoshilinch emas.
- **Render deploy**: `.env` dagi S3 qiymatlari Supabase'niki bo'lgani uchun Render'da ham ishlaydi (o'zgartirish shart emas).

---

## 📌 ESLATMA
- Frontend = production Vite build (nginx). `.tsx` o'zgarishlari **rebuild** talab qiladi.
- Backend hot-reload — o'zgargan, qayta ishga tushgan, S3 ulanish tasdiqlangan.
- `image_url` maydoni bazada allaqachon bor — **migration kerak emas**.
