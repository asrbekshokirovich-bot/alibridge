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

interface QuickIntakeResponse {
  spec_id: string;
  count: number;
  products: Array<{ id: string; short_code: string; qr_payload: string }>;
}

interface LabelItem {
  id: string;
  short_code: string;
  qr_image_b64: string;
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
  const [itemsPerContainer, setItemsPerContainer] = useState('');
  const [grossKg, setGrossKg] = useState('');
  const [tareKg, setTareKg] = useState('');
  const [price, setPrice] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [specId, setSpecId] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // Bulk tanlov
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

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
    setItemsPerContainer('');
    setGrossKg('');
    setTareKg('');
    setPrice('');
    setTotalValue('');
    setPhotos([]);
    setPhotoPreviews([]);
    setError(null);
  };

  // Rejimga oid hisoblar (box/textile sof vazn kalkulyatori)
  const isContainer = mode !== 'piece';
  const containerWord = "to'plam";
  const qtyNum = parseInt(quantity) || 0;
  const grossNum = parseFloat(grossKg.replace(',', '.')) || 0;
  const tareNum = parseFloat(tareKg.replace(',', '.')) || 0;
  const netTotalKg = Math.max(0, grossNum - tareNum * qtyNum);
  const perContainerKg = qtyNum > 0 ? netTotalKg / qtyNum : 0;
  const containerWeightG = Math.round(perContainerKg * 1000);

  const intakeMutation = useMutation({
    mutationFn: async () => {
      const qty = parseInt(quantity);
      if (!name.trim()) throw new Error("Mahsulot nomini kiriting");
      if (!qty || qty < 1 || qty > 10000) throw new Error("Soni 1–10000 oralig'ida bo'lishi kerak");

      let wg: number;
      let itemsPer: number | null = null;
      if (isContainer) {
        itemsPer = parseInt(itemsPerContainer);
        if (!itemsPer || itemsPer < 1) throw new Error(`Har ${containerWord}dagi dona sonini kiriting`);
        wg = containerWeightG;
        if (!wg || wg < 1) throw new Error("Sof vaznni to'g'ri kiriting (to'la vazn bo'sh quti×sonidan katta bo'lsin)");
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
          total_value: declaredValue,
          photos,
          mode,
          items_per_container: itemsPer,
        }
      );
      return data;
    },
    onSuccess: (data) => {
      haptic('success');
      setSpecId(data.spec_id);
      setCreatedCount(data.count);
      setDeletedIds(new Set());
      setSelectedIds(new Set());
      setSelectMode(false);
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
            Mahsulot ma'lumotlarini kiriting — QR kodlar avtomatik yaratiladi
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

            {/* Soni — rejimga qarab dona/to'plam */}
            <div>
              <label className="mb-1 block text-xs font-medium text-tg-hint">
                {mode === 'textile' ? "To'plam soni" : 'Soni (dona)'}
              </label>
              <input
                type="number"
                min={1}
                max={10000}
                placeholder={isContainer ? '10' : '30'}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-lg border border-tg-secondary-bg bg-tg-secondary-bg px-3 py-2 text-sm text-tg-text outline-none focus:border-tg-button"
              />
            </div>

            {/* Har konteyner (quti/to'plam) dagi dona soni */}
            {isContainer && (
              <div>
                <label className="mb-1 block text-xs font-medium text-tg-hint">
                  Har {containerWord}dagi dona soni
                </label>
                <input
                  type="number"
                  min={1}
                  placeholder="5"
                  value={itemsPerContainer}
                  onChange={(e) => setItemsPerContainer(e.target.value)}
                  className="w-full rounded-lg border border-tg-secondary-bg bg-tg-secondary-bg px-3 py-2 text-sm text-tg-text outline-none focus:border-tg-button"
                />
              </div>
            )}

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
                <p className="text-xs font-semibold text-tg-text">⚖️ Sof vazn hisoblash</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-tg-hint">To'la vazn (jami, kg)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="120"
                      value={grossKg}
                      onChange={(e) => { const v = e.target.value.replace(',', '.'); if (/^\d*\.?\d{0,3}$/.test(v) || v === '') setGrossKg(v); }}
                      className="w-full rounded-lg border border-tg-secondary-bg bg-tg-secondary-bg px-3 py-2 text-sm text-tg-text outline-none focus:border-tg-button"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-tg-hint">1 ta bo'sh {containerWord} (kg)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.5"
                      value={tareKg}
                      onChange={(e) => { const v = e.target.value.replace(',', '.'); if (/^\d*\.?\d{0,3}$/.test(v) || v === '') setTareKg(v); }}
                      className="w-full rounded-lg border border-tg-secondary-bg bg-tg-secondary-bg px-3 py-2 text-sm text-tg-text outline-none focus:border-tg-button"
                    />
                  </div>
                </div>
                <div className="rounded-lg bg-tg-secondary-bg px-3 py-2 text-xs text-tg-text">
                  Sof jami: <b>{netTotalKg.toFixed(2)} kg</b> · 1 {containerWord}: <b>{perContainerKg.toFixed(2)} kg</b>
                  {grossNum > 0 && qtyNum > 0 && netTotalKg === 0 && (
                    <span className="text-red-500"> — to'la vazn yetarli emas</span>
                  )}
                </div>
              </div>
            )}

            {/* Kargo narxi — carrier katalogida ko'rinadi */}
            <div>
              <label className="mb-1 block text-xs font-medium text-tg-hint">
                Olib ketish narxi (USD, bir dona)
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="5.00"
                value={price}
                onChange={(e) => {
                  const val = e.target.value.replace(',', '.');
                  if (/^\d*\.?\d{0,2}$/.test(val) || val === '') setPrice(val);
                }}
                className="w-full rounded-lg border border-tg-secondary-bg bg-tg-secondary-bg px-3 py-2 text-sm text-tg-text outline-none focus:border-tg-button"
              />
            </div>

            {/* Mahsulot qiymati — yo'qotilsa/zararlansa yo'lovchi qarzi shu summa */}
            <div>
              <label className="mb-1 block text-xs font-medium text-tg-hint">
                Mahsulotning narxi (1 dona qiymati, USD)
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="100.00"
                value={totalValue}
                onChange={(e) => {
                  const val = e.target.value.replace(',', '.');
                  if (/^\d*\.?\d{0,2}$/.test(val) || val === '') setTotalValue(val);
                }}
                className="w-full rounded-lg border border-tg-secondary-bg bg-tg-secondary-bg px-3 py-2 text-sm text-tg-text outline-none focus:border-tg-button"
              />
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
          ✅ Qabul qilish va QR yaratish
        </Button>
      </div>
    );
  }

  // ── Result ekrani — QR kodlar ───────────────────────────────────────────────
  if (labelsLoading) return <LoadingScreen />;

  const visibleLabels = labels?.filter((item) => !deletedIds.has(item.id)) ?? [];
  const allSelected = visibleLabels.length > 0 && selectedIds.size === visibleLabels.length;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(visibleLabels.map((i) => i.id)));
    haptic('light');
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    haptic('warning');
    try {
      await Promise.all(
        [...selectedIds].map((id) => api.delete(`/warehouse/uz/products/${id}`))
      );
      haptic('success');
      setDeletedIds((prev) => {
        const next = new Set(prev);
        selectedIds.forEach((id) => next.add(id));
        return next;
      });
      setSelectedIds(new Set());
      setSelectMode(false);
      setConfirmBulkDelete(false);
    } catch {
      haptic('error');
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4 pb-32">
      {/* Sarlavha */}
      <Card className="bg-emerald-500/15">
        <div className="text-center">
          <p className="text-2xl">✅</p>
          <p className="mt-1 font-bold text-emerald-400">
            Mahsulot muvaffaqiyatli qabul qilindi!
          </p>
          <p className="text-sm text-emerald-400">{createdCount} ta QR kod yaratildi</p>
          <p className="mt-1 text-xs text-tg-hint">
            QR kodlarni mahsulotlarga yoprishtiring
          </p>
        </div>
      </Card>

      {/* Tanlov boshqaruv satri */}
      {visibleLabels.length > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-tg-secondary-bg px-4 py-2.5">
          {selectMode ? (
            <>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 accent-tg-button"
                />
                {allSelected ? 'Barchasini bekor qilish' : 'Barchasini belgilash'}
              </label>
              <div className="flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <span className="text-xs font-semibold text-tg-button">
                    {selectedIds.size} ta
                  </span>
                )}
                <button
                  onClick={() => { setSelectMode(false); setSelectedIds(new Set()); setConfirmBulkDelete(false); haptic('light'); }}
                  className="rounded-lg bg-white/10 px-2 py-1 text-xs font-semibold text-tg-hint active:scale-95"
                >
                  ✕ Bekor
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="text-xs text-tg-hint">{visibleLabels.length} ta mahsulot</span>
              <button
                onClick={() => { setSelectMode(true); haptic('light'); }}
                className="rounded-lg bg-tg-button px-3 py-1 text-xs font-semibold text-white active:scale-95"
              >
                ☑ Tanlash
              </button>
            </>
          )}
        </div>
      )}

      {/* QR kodlar ro'yxati */}
      {visibleLabels.map((item) => (
        <Card
          key={item.id}
          className={`transition-all ${selectMode && selectedIds.has(item.id) ? 'ring-2 ring-tg-button' : ''}`}
          onClick={selectMode ? () => { toggleSelect(item.id); haptic('light'); } : undefined}
        >
          <div className="flex items-center gap-3">
            {/* Checkbox */}
            {selectMode && (
              <input
                type="checkbox"
                checked={selectedIds.has(item.id)}
                onChange={() => toggleSelect(item.id)}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4 flex-shrink-0 accent-tg-button"
              />
            )}
            {/* QR rasm */}
            <img
              src={`data:image/png;base64,${item.qr_image_b64}`}
              alt={item.short_code}
              className="h-20 w-20 flex-shrink-0 rounded"
            />
            {/* Ma'lumotlar + bitta o'chirish */}
            <div className="flex flex-1 items-center justify-between">
              <div>
                <p className="font-mono text-xl font-bold tracking-wider">
                  {item.short_code}
                </p>
                <p className="text-xs text-tg-hint">{name}</p>
              </div>
              {!selectMode && (
                deletingId === item.id ? (
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={async () => {
                        try {
                          await api.delete(`/warehouse/uz/products/${item.id}`);
                          haptic('success');
                          setDeletedIds((prev) => new Set(prev).add(item.id));
                        } catch { haptic('error'); }
                        setDeletingId(null);
                      }}
                      className="rounded px-2 py-1 text-xs font-medium bg-red-500 text-white active:scale-95"
                    >
                      ✓ Ha
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="rounded px-2 py-1 text-xs font-medium bg-white/10 text-tg-hint active:scale-95"
                    >
                      Yo'q
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { haptic('light'); setDeletingId(item.id); }}
                    className="rounded-lg px-2 py-1.5 text-xs font-medium text-red-500 bg-red-500/15 active:scale-95"
                  >
                    🗑
                  </button>
                )
              )}
            </div>
          </div>
        </Card>
      ))}

      {/* Yangi qabul tugmasi */}
      {!selectMode && (
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
      )}

      {/* Sticky bottom — bulk delete */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-tg-sectionBg p-4 shadow-xl">
          {confirmBulkDelete ? (
            <div className="flex flex-col gap-2">
              <p className="text-center text-sm font-semibold text-red-400">
                {selectedIds.size} ta mahsulot o'chirilsinmi?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmBulkDelete(false)}
                  className="flex-1 rounded-xl bg-white/5 py-3 text-sm font-semibold text-tg-hint active:scale-95"
                >
                  Bekor
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-semibold text-white active:scale-95 disabled:opacity-50"
                >
                  {bulkDeleting ? "⏳ O'chirilmoqda..." : "🗑 Ha, o'chirish"}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setConfirmBulkDelete(true); haptic('warning'); }}
              className="w-full rounded-xl bg-red-500 py-3 text-sm font-semibold text-white active:scale-95"
            >
              🗑 {selectedIds.size} ta mahsulotni o'chirish
            </button>
          )}
        </div>
      )}
    </div>
  );
}
