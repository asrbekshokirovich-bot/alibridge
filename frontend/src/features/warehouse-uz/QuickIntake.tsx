/**
 * Tezkor qabul — buyurtmasiz tovarlarni qabul qilish.
 *
 * 1-qadam (form): nomi, soni, og'irlik
 * 2-qadam (result): yaratilgan mahsulotlar + QR kodlar
 */
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, extractErrorMessage } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { useBackButton, haptic } from '@shared/hooks/useTelegram';
import { useAuthStore } from '@shared/store/auth';

async function openPdf(specId: string) {
  if (!useAuthStore.getState().token) { alert('Avval login qiling'); return; }
  try {
    const { data } = await api.post<{ token: string }>('/auth/download-token');
    const url = `${window.location.origin}/api/v1/warehouse/uz/products/specs/${specId}/pdf?token=${encodeURIComponent(data.token)}`;
    if ((window as any).Telegram?.WebApp?.openLink) {
      (window as any).Telegram.WebApp.openLink(url);
    } else {
      window.open(url, '_blank');
    }
  } catch {
    alert("Yuklab olishda xatolik. Qayta urinib ko'ring.");
  }
}

function CurrencyToggle({ value, onChange }: { value: 'USD' | 'UZS'; onChange: (c: 'USD' | 'UZS') => void }) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-lg border border-tg-secondary-bg">
      {(['USD', 'UZS'] as const).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => { onChange(c); haptic('light'); }}
          className={`px-3 py-2 text-sm font-medium ${value === c ? 'bg-tg-button text-white' : 'bg-tg-secondary-bg text-tg-hint'}`}
        >
          {c === 'USD' ? '$' : "so'm"}
        </button>
      ))}
    </div>
  );
}

interface QuickIntakeResponse {
  spec_id: string;
  count: number;
  products: Array<{ id: string; short_code: string; qr_payload: string }>;
}

interface LabelItem {
  id: string;
  short_code: string;
  name: string;
  date: string;
  qty: number;
  barcode_image_b64: string;
}

export default function WarehouseUzQuickIntake() {
  const navigate = useNavigate();
  const CATEGORY_CHIPS = [
    { emoji: '📱', name: 'Telefonlar' },
    { emoji: '👟', name: 'Krasovkalar' },
    { emoji: '👕', name: 'Kiyimlar' },
    { emoji: '💍', name: 'Aksessuarlar' },
    { emoji: '🏠', name: 'Maishiy texnika' },
    { emoji: '🛋️', name: 'Mebel' },
    { emoji: '📦', name: 'Boshqa' },
  ];

  const [step, setStep] = useState<'form' | 'result'>('form');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('');
  const [weightG, setWeightG] = useState('');
  const [mode, setMode] = useState<'piece' | 'textile'>('piece');
  const [grossKg, setGrossKg] = useState('');
  const [tareKg, setTareKg] = useState('');
  const [price, setPrice] = useState('');
  const [priceCurrency, setPriceCurrency] = useState<'USD' | 'UZS'>('USD');
  const [totalValue, setTotalValue] = useState('');
  const [valueCurrency, setValueCurrency] = useState<'USD' | 'UZS'>('USD');
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [specId, setSpecId] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useBackButton(() => {
    if (step === 'result') {
      setStep('form');
      resetForm();
    } else {
      navigate(-1);
    }
  });

  // QR labellar — result bosqichida yuklanadi
  const { data: labels, isLoading: labelsLoading } = useQuery<LabelItem[]>({
    queryKey: ['quick-intake-labels', specId],
    queryFn: async () => {
      const { data } = await api.get<LabelItem[]>(
        `/warehouse/uz/quick-intake/${specId}/labels`
      );
      return data;
    },
    enabled: !!specId && step === 'result',
  });

  // Rasm yuklash — galereya yoki kamera
  const handlePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // bir rasmni qayta tanlash mumkin bo'lsin
    if (!file) return;
    setUploadingPhoto(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post<{ url: string }>(
        '/uploads?category=intake',
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setPhotos((prev) => [...prev, data.url]);
      setPhotoPreviews((prev) => [...prev, URL.createObjectURL(file)]);
      haptic('success');
    } catch {
      setError("Rasmni yuklashda xatolik. Qayta urinib ko'ring.");
      haptic('error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== idx));
    haptic('light');
  };

  const resetForm = () => {
    setName('');
    setCategory('');
    setQuantity('');
    setWeightG('');
    setGrossKg('');
    setTareKg('');
    setPrice('');
    setPriceCurrency('USD');
    setTotalValue('');
    setValueCurrency('USD');
    setPhotos([]);
    setPhotoPreviews([]);
    setError(null);
  };

  // Tekstil: mahsulot(sof) vazni va quti(tara) vazni ALOHIDA kiritiladi.
  // weight_g (unit_weight_g) = sof jami; tare_weight_g = quti jami. Brutto = sof + tara (ko'rsatuv).
  const isContainer = mode !== 'piece';
  const netKg = parseFloat(grossKg.replace(',', '.')) || 0;   // mahsulot (sof) jami vazni
  const tareNum = parseFloat(tareKg.replace(',', '.')) || 0;  // quti(lar) jami vazni
  const grossTotalKg = netKg + tareNum;                        // brutto (sof + tara)
  const netWeightG = Math.round(netKg * 1000);
  const tareWeightG = Math.round(tareNum * 1000);

  const intakeMutation = useMutation({
    mutationFn: async () => {
      const qty = parseInt(quantity);
      if (!name.trim()) throw new Error("Mahsulot nomini kiriting");
      if (!qty || qty < 1 || qty > 10000) throw new Error("Soni 1–10000 oralig'ida bo'lishi kerak");

      let wg: number;
      let tareG: number | null = null;
      if (isContainer) {
        // Tekstil: mahsulot(sof) vazni va quti(tara) vazni alohida kiritiladi
        if (!netKg || netKg <= 0) throw new Error("Mahsulot (sof) vaznini kiriting (kg)");
        if (tareNum < 0) throw new Error("Quti vazni manfiy bo'lmaydi");
        wg = netWeightG;
        if (!wg || wg < 1) throw new Error("Sof vazn juda kichik — qiymatlarni tekshiring");
        tareG = tareWeightG;
      } else {
        wg = parseInt(weightG);
        if (!wg || wg < 1) throw new Error("Bir dona og'irligini (gramm) kiriting");
      }

      const rawPrice = parseFloat(price.replace(',', '.')) || 0;
      const cargoPrice = Math.round(rawPrice * 100) / 100;
      const rawValue = parseFloat(totalValue.replace(',', '.')) || 0;
      const declaredValue = Math.round(rawValue * 100) / 100;
      const { data } = await api.post<QuickIntakeResponse>(
        '/warehouse/uz/quick-intake',
        {
          name: name.trim(),
          quantity: qty,
          weight_g: wg,
          category: mode === 'textile' ? 'Tekstil' : (category.trim() || null),
          cargo_price: cargoPrice,
          cargo_currency: priceCurrency,
          total_value: declaredValue,
          total_value_currency: valueCurrency,
          tare_weight_g: tareG,
          photos,
          mode,
        }
      );
      return data;
    },
    onSuccess: (data) => {
      haptic('success');
      setSpecId(data.spec_id);
      setCreatedCount(data.count);
      resetForm();
      setStep('result');
    },
    onError: (err: unknown) => {
      haptic('error');
      setError(err instanceof Error ? err.message : extractErrorMessage(err));
    },
  });

  // ── Form ekrani ─────────────────────────────────────────────────────────────
  if (step === 'form') {
    return (
      <div className="flex flex-col gap-3 p-4 pb-24">
        <div className="py-2">
          <h2 className="text-lg font-bold">⚡ Tezkor qabul</h2>
          <p className="text-sm text-tg-hint">
            Mahsulot ma'lumotlarini kiriting — barcode avtomatik yaratiladi
          </p>
        </div>

        <Card>
          <div className="space-y-3">
            {/* Rejim selektori — mahsulot turi */}
            <div>
              <label className="mb-1 block text-xs font-medium text-tg-hint">Mahsulot turi</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: 'piece', icon: '🔢', label: 'Dona' },
                  { key: 'textile', icon: '🧵', label: 'Tekstil' },
                ] as const).map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => { setMode(m.key); haptic('light'); }}
                    className={`rounded-xl border py-2 text-sm font-medium ${mode === m.key ? 'border-tg-button bg-tg-button/10 text-tg-button' : 'border-tg-secondary-bg bg-tg-secondary-bg text-tg-text'}`}
                  >
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mahsulot rasmi */}
            <div>
              <label className="mb-1 block text-xs font-medium text-tg-hint">
                Mahsulot rasmi
              </label>
              <div className="flex flex-wrap gap-2">
                {photoPreviews.map((src, idx) => (
                  <div key={idx} className="relative h-20 w-20">
                    <img src={src} alt="" className="h-20 w-20 rounded-lg object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white"
                    >×</button>
                  </div>
                ))}
                {/* Galereyadan tanlash */}
                <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-tg-hint/40 text-tg-hint active:scale-95">
                  {uploadingPhoto ? (
                    <span className="text-xl">⏳</span>
                  ) : (
                    <>
                      <span className="text-xl">🖼️</span>
                      <span className="text-[10px] leading-tight">Yuklash</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={uploadingPhoto}
                    onChange={handlePhotoFile}
                  />
                </label>
                {/* Kameradan olish */}
                <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-tg-hint/40 text-tg-hint active:scale-95">
                  <span className="text-xl">📷</span>
                  <span className="text-[10px] leading-tight">Rasmga olish</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    disabled={uploadingPhoto}
                    onChange={handlePhotoFile}
                  />
                </label>
              </div>
            </div>

            {/* Kategoriya — tekstilda avtomatik "Tekstil" */}
            {mode === 'textile' ? (
              <div className="rounded-lg bg-tg-secondary-bg px-3 py-2 text-xs text-tg-hint">
                🧵 Kategoriya: <span className="font-semibold text-tg-text">Tekstil</span> (avtomatik)
              </div>
            ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-tg-hint">
                Kategoriya
              </label>
              {/* Chip tugmalar */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {CATEGORY_CHIPS.map((chip) => (
                  <button
                    key={chip.name}
                    type="button"
                    onClick={() => setCategory(category === chip.name ? '' : chip.name)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      category === chip.name
                        ? 'bg-tg-button text-white'
                        : 'bg-tg-secondaryBg text-tg-text'
                    }`}
                  >
                    {chip.emoji} {chip.name}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Yoki o'zingiz yozing..."
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-tg-secondary-bg bg-tg-secondary-bg px-3 py-2 text-sm text-tg-text outline-none focus:border-tg-button"
              />
            </div>
            )}

            {/* Mahsulot nomi */}
            <div>
              <label className="mb-1 block text-xs font-medium text-tg-hint">
                Mahsulot nomi / modeli
              </label>
              <input
                type="text"
                placeholder="Masalan: Samsung A33, Iphone 15"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-tg-secondary-bg bg-tg-secondary-bg px-3 py-2 text-sm text-tg-text outline-none focus:border-tg-button"
              />
            </div>

            {/* Soni (dona) — umumiy mahsulot soni */}
            <div>
              <label className="mb-1 block text-xs font-medium text-tg-hint">
                Soni (dona)
              </label>
              <input
                type="number"
                min={1}
                max={10000}
                placeholder="30"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-lg border border-tg-secondary-bg bg-tg-secondary-bg px-3 py-2 text-sm text-tg-text outline-none focus:border-tg-button"
              />
            </div>

            {/* Vazn — dona: bir dona (g); quti/tekstil: sof vazn kalkulyatori */}
            {!isContainer ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-tg-hint">
                  Bir dona og'irligi (gramm)
                </label>
                <input
                  type="number"
                  min={1}
                  placeholder="150"
                  value={weightG}
                  onChange={(e) => setWeightG(e.target.value)}
                  className="w-full rounded-lg border border-tg-secondary-bg bg-tg-secondary-bg px-3 py-2 text-sm text-tg-text outline-none focus:border-tg-button"
                />
              </div>
            ) : (
              <div className="space-y-2 rounded-xl border border-tg-secondary-bg p-3">
                <p className="text-xs font-semibold text-tg-text">⚖️ Vazn (alohida)</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-tg-hint">Mahsulot vazni (sof, kg)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="8500"
                      value={grossKg}
                      onChange={(e) => { const v = e.target.value.replace(',', '.'); if (/^\d*\.?\d{0,3}$/.test(v) || v === '') setGrossKg(v); }}
                      className="w-full rounded-lg border border-tg-secondary-bg bg-tg-secondary-bg px-3 py-2 text-sm text-tg-text outline-none focus:border-tg-button"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-tg-hint">Quti(lar) vazni (kg)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="500"
                      value={tareKg}
                      onChange={(e) => { const v = e.target.value.replace(',', '.'); if (/^\d*\.?\d{0,3}$/.test(v) || v === '') setTareKg(v); }}
                      className="w-full rounded-lg border border-tg-secondary-bg bg-tg-secondary-bg px-3 py-2 text-sm text-tg-text outline-none focus:border-tg-button"
                    />
                  </div>
                </div>
                <div className="rounded-lg bg-tg-secondary-bg px-3 py-2 text-xs text-tg-text">
                  Brutto (sof + quti): <b>{grossTotalKg.toFixed(2)} kg</b>
                  {tareNum > 0 && <> · quti: <b>{tareNum.toFixed(2)} kg</b></>}
                </div>
              </div>
            )}

            {/* Kargo narxi — carrier katalogida ko'rinadi */}
            <div>
              <label className="mb-1 block text-xs font-medium text-tg-hint">
                Olib ketish narxi ({mode === 'textile' ? 'jami' : 'bir dona'})
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={priceCurrency === 'USD' ? '5.00' : '60000'}
                  value={price}
                  onChange={(e) => {
                    const val = e.target.value.replace(',', '.');
                    if (/^\d*\.?\d{0,2}$/.test(val) || val === '') setPrice(val);
                  }}
                  className="flex-1 rounded-lg border border-tg-secondary-bg bg-tg-secondary-bg px-3 py-2 text-sm text-tg-text outline-none focus:border-tg-button"
                />
                <CurrencyToggle value={priceCurrency} onChange={(c) => { setPriceCurrency(c); setPrice(''); }} />
              </div>
            </div>

            {/* Mahsulot qiymati — yo'qotilsa/zararlansa yo'lovchi qarzi shu summa */}
            <div>
              <label className="mb-1 block text-xs font-medium text-tg-hint">
                Mahsulotning narxi (1 dona qiymati)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={valueCurrency === 'USD' ? '100.00' : '1200000'}
                  value={totalValue}
                  onChange={(e) => {
                    const val = e.target.value.replace(',', '.');
                    if (/^\d*\.?\d{0,2}$/.test(val) || val === '') setTotalValue(val);
                  }}
                  className="flex-1 rounded-lg border border-tg-secondary-bg bg-tg-secondary-bg px-3 py-2 text-sm text-tg-text outline-none focus:border-tg-button"
                />
                <CurrencyToggle value={valueCurrency} onChange={setValueCurrency} />
              </div>
              <p className="mt-1 text-[11px] text-tg-hint">
                Yo'lovchi yukni yo'qotsa/zararlasa shu summa qarz sifatida yoziladi
              </p>
            </div>
          </div>
        </Card>

        {error && (
          <p className="rounded-lg bg-red-500/15 px-4 py-2 text-center text-sm text-red-400">
            {error}
          </p>
        )}

        <Button
          fullWidth
          size="lg"
          loading={intakeMutation.isPending}
          onClick={() => intakeMutation.mutate()}
        >
          ✅ Qabul qilish va barcode yaratish
        </Button>
      </div>
    );
  }

  // ── Result ekrani — bitta barcode yorliq ────────────────────────────────────
  if (labelsLoading) return <LoadingScreen />;

  const label = labels?.[0] ?? null;

  return (
    <div className="flex flex-col gap-3 p-4 pb-8">
      {/* Sarlavha */}
      <Card className="bg-emerald-500/15">
        <div className="text-center">
          <p className="text-2xl">✅</p>
          <p className="mt-1 font-bold text-emerald-400">
            Mahsulot muvaffaqiyatli qabul qilindi!
          </p>
          <p className="text-sm text-emerald-400">{createdCount} dona · 1 ta yorliq</p>
        </div>
      </Card>

      {/* Bitta barcode yorliq — nomi + sana + soni + barcode */}
      {label && (
        <Card>
          <div className="flex flex-col items-center gap-2 py-2">
            <p className="text-center text-base font-bold text-tg-text">{label.name}</p>
            <p className="text-xs text-tg-hint">
              {label.date}{label.qty > 1 ? `  ·  ${label.qty} dona` : ''}
            </p>
            <img
              src={`data:image/png;base64,${label.barcode_image_b64}`}
              alt={label.short_code}
              className="my-1 w-full max-w-[280px] rounded bg-white p-2"
            />
            <p className="text-center text-base font-bold text-tg-text">{label.name}</p>
            <p className="text-xs text-tg-hint">
              {label.date}{label.qty > 1 ? `  ·  ${label.qty} dona` : ''}
            </p>
          </div>
        </Card>
      )}

      {/* Chop etish (PDF) */}
      {specId && (
        <Button
          fullWidth
          onClick={() => { haptic('light'); openPdf(specId); }}
        >
          🖨️ Yorliqni chop etish (PDF)
        </Button>
      )}

      {/* Yangi qabul */}
      <Button
        fullWidth
        variant="secondary"
        onClick={() => {
          setStep('form');
          setSpecId(null);
          resetForm();
        }}
      >
        ⚡ Yangi qabul
      </Button>
    </div>
  );
}
