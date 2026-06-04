/**
 * Admin — Mahsulotlar (3 qatlam)
 *
 * 1. Spec guruhlari:  "iPhone — 30 ta"
 * 2. Guruh ichidagi mahsulotlar: short_code, status
 * 3. Mahsulot QR kodi: katta QR rasm
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { EmptyState } from '@shared/components/EmptyState';
import { ProductThumb } from '@shared/components/ProductThumb';
import { useBackButton, haptic } from '@shared/hooks/useTelegram';

// ─── PDF ochish (Telegram Mini App uchun) ─────────────────────────────────────
// Telegram WebView'da blob download ishlamaydi; openLink tashqi brauzerda ochadi
// (Authorization header yubora olmaydi). Shuning uchun URL'ga token kerak.
// H1: oddiy sessiya tokeni emas, balki QISQA MUDDATLI (120s) download token
// ishlatiladi — log'ga tushsa ham tezda eskiradi.

import { useAuthStore } from '@shared/store/auth';

async function openPdfUrl(apiPath: string) {
  if (!useAuthStore.getState().token) { alert('Avval login qiling'); return; }

  try {
    // Qisqa muddatli download token olish
    const { data } = await api.post<{ token: string }>('/auth/download-token');

    const base = `${window.location.origin}/api/v1`;
    const sep  = apiPath.includes('?') ? '&' : '?';
    const url  = `${base}${apiPath}${sep}token=${encodeURIComponent(data.token)}`;

    // Telegram SDK openLink — tashqi brauzerda ochadi (iOS/Android)
    const tg = (window as unknown as { Telegram?: { WebApp?: { openLink?: (u: string) => void } } }).Telegram?.WebApp;
    if (tg?.openLink) {
      tg.openLink(url);
    } else {
      window.open(url, '_blank');
    }
    haptic('success');
  } catch {
    alert("Yuklab olishda xatolik. Qayta urinib ko'ring.");
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SpecGroup {
  spec_id: string;
  title: string;
  photo: string | null;
  count: number;       // omborda (AT_TASHKENT_WH + IN_BASKET)
  total_count: number; // jami tizimda
  last_created: string;
}

interface ProductItem {
  id: string;
  short_code: string;
  status: string;
  label_printed: boolean;
  created_at: string;
  qr_payload: string;
}

interface ProductQr {
  id: string;
  short_code: string;
  status: string;
  qr_image_b64: string;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending_intake:   '📦 Qabul kutmoqda',
  at_tashkent_wh:   '🏭 Toshkent ombor',
  in_basket:        '🛒 Savatda',
  with_courier_uz:  '🚚 Kuryer (UZ)',
  with_carrier:     '✈️ Yo\'lovchi bilan',
  in_flight:        '🛫 Parvozda',
  with_courier_tr:  '🚚 Kuryer (TR)',
  at_tr_wh:         '🏬 Turk ombor',
  delivered:        '✅ Yetkazildi',
  lost:             '❌ Yo\'qoldi',
  cancelled:        '🚫 Bekor',
};

const STATUS_COLORS: Record<string, string> = {
  pending_intake:   'bg-accent-amber/20 text-accent-amber',
  at_tashkent_wh:   'bg-accent-blue/15 text-accent-blue',
  in_basket:        'bg-accent-amber/20 text-accent-amber',
  with_courier_uz:  'bg-accent-violet/15 text-accent-violet',
  with_carrier:     'bg-accent-violet/15 text-accent-violet',
  in_flight:        'bg-accent-blue/15 text-accent-blue',
  with_courier_tr:  'bg-accent-violet/15 text-accent-violet',
  at_tr_wh:         'bg-emerald-500/20 text-emerald-400',
  delivered:        'bg-emerald-500/20 text-emerald-400',
  lost:             'bg-red-500/20 text-red-400',
  cancelled:        'bg-white/10 text-tg-hint',
};

// ─── View 1 — Spec guruhlari ──────────────────────────────────────────────────

function SpecsView({
  onSelect,
  readOnly = false,
}: {
  onSelect: (spec: SpecGroup) => void;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useBackButton(() => navigate(-1));

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((handleSearch as unknown as { _t?: ReturnType<typeof setTimeout> })._t);
    const timer = setTimeout(() => setDebounced(val), 400);
    (handleSearch as unknown as { _t?: ReturnType<typeof setTimeout> })._t = timer;
  };

  const { data: specs = [], isLoading } = useQuery<SpecGroup[]>({
    queryKey: ['admin-product-specs', debounced],
    queryFn: async () => {
      const params = new URLSearchParams({ q: debounced, limit: '200' });
      const { data } = await api.get<SpecGroup[]>(`/admin/products/specs?${params}`);
      return data;
    },
  });

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="space-y-3 p-4 pb-24">
      <h2 className="px-1 text-lg font-bold">{t('admin.products')}</h2>

      <input
        type="text"
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Qidirish (nomi bo'yicha)..."
        className="w-full rounded-xl border border-tg-secondary-bg bg-tg-secondary-bg
                   px-4 py-2.5 text-sm outline-none focus:border-tg-button"
      />

      {specs.length > 0 && (
        <p className="px-1 text-xs text-tg-hint">{specs.length} ta guruh</p>
      )}

      {specs.length === 0 && (
        <EmptyState icon="📦" title={t('admin.no_products')} />
      )}

      {specs.map((spec) => (
        <Card key={spec.spec_id}>
          <div className="flex items-center gap-3">
            {/* Mahsulot rasmi */}
            <div
              className="flex-shrink-0 cursor-pointer active:opacity-70"
              onClick={() => { haptic('light'); onSelect(spec); }}
            >
              <ProductThumb src={spec.photo} />
            </div>
            {/* Asosiy ma'lumot — tap ile ichiga kirish */}
            <div
              className="min-w-0 flex-1 cursor-pointer active:opacity-70"
              onClick={() => { haptic('light'); onSelect(spec); }}
            >
              <p className="truncate font-semibold">{spec.title}</p>
              <p className="mt-0.5 text-xs text-tg-hint">
                {new Date(spec.last_created).toLocaleDateString('uz-UZ', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                })}
              </p>
            </div>
            {/* Soni + PDF tugmasi */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div
                className="flex flex-col items-end cursor-pointer active:opacity-70"
                onClick={() => { haptic('light'); onSelect(spec); }}
              >
                <span className="rounded-full bg-tg-button px-3 py-1 text-sm font-bold text-white">
                  🏭 {spec.count} ta
                </span>
                {spec.total_count !== spec.count && (
                  <span className="mt-0.5 text-xs text-tg-hint px-1">
                    jami {spec.total_count}
                  </span>
                )}
              </div>
              {!readOnly && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openPdfUrl(`/admin/products/specs/${spec.spec_id}/labels-pdf`);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-lg active:scale-95"
                  title="PDF yuklash"
                >
                  🖨️
                </button>
              )}
              <span
                className="text-tg-hint text-lg cursor-pointer"
                onClick={() => { haptic('light'); onSelect(spec); }}
              >›</span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── View 2 — Guruh ichidagi mahsulotlar ──────────────────────────────────────

function ItemsView({
  spec,
  onBack,
  onSelect,
  readOnly = false,
}: {
  spec: SpecGroup;
  onBack: () => void;
  onSelect: (item: ProductItem) => void;
  readOnly?: boolean;
}) {
  const queryClient = useQueryClient();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // Bitta o'chirish uchun inline tasdiq
  const [confirmOneId, setConfirmOneId] = useState<string | null>(null);

  // Ko'plab o'chirish uchun pastki tasdiq
  const [pendingBulkIds, setPendingBulkIds] = useState<string[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useBackButton(() => {
    if (pendingBulkIds.length > 0) { setPendingBulkIds([]); return; }
    if (confirmOneId) { setConfirmOneId(null); return; }
    if (selectMode) { setSelectMode(false); setSelectedIds(new Set()); return; }
    onBack();
  });

  const { data: items = [], isLoading } = useQuery<ProductItem[]>({
    queryKey: ['admin-spec-items', spec.spec_id],
    queryFn: async () => {
      const { data } = await api.get<ProductItem[]>(
        `/admin/products/specs/${spec.spec_id}/items`
      );
      return data;
    },
  });

  const visibleItems = items.filter((i) => !deletedIds.has(i.id));
  const allSelected = visibleItems.length > 0 && selectedIds.size === visibleItems.length;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Haqiqiy o'chirish — 1 ta bulk so'rov (connection pool uchun xavfsiz)
  const executeDelete = async (ids: string[]) => {
    if (ids.length === 0) return;
    setDeleteError(null);
    setDeleteLoading(true);
    const idSet = new Set(ids);

    try {
      if (ids.length === 1) {
        // Bitta mahsulot — oddiy DELETE
        await api.delete(`/admin/products/${ids[0]}`);
      } else {
        // Ko'p mahsulot — BITTA so'rov, BITTA transaksiya
        await api.delete(
          `/admin/products/bulk?ids=${encodeURIComponent(ids.join(','))}`
        );
      }
      haptic('success');
      setDeletedIds((prev) => new Set([...prev, ...idSet]));
      setSelectedIds(new Set());
      setSelectMode(false);
      setConfirmOneId(null);
      setPendingBulkIds([]);
      queryClient.invalidateQueries({ queryKey: ['admin-spec-items', spec.spec_id] });
      queryClient.invalidateQueries({ queryKey: ['admin-product-specs'] });
    } catch (err: unknown) {
      haptic('error');
      const msg = (err as { response?: { data?: { error?: { message?: string } } }; message?: string })
        ?.response?.data?.error?.message
        || (err as { message?: string })?.message
        || 'Serverda xato yuz berdi';
      setDeleteError(msg);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (isLoading) return <LoadingScreen />;

  // ── Tasdiq ekrani: sahifaning o'rnini bosadi ──────────────────────────────
  if (pendingBulkIds.length > 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6">
        <div className="text-5xl">🗑️</div>
        <p className="text-center text-lg font-bold text-tg-text">
          {pendingBulkIds.length} ta mahsulot o'chirilsinmi?
        </p>
        <p className="text-center text-sm text-tg-hint">
          Bu amalni qaytarib bo'lmaydi.
        </p>

        {deleteError && (
          <div className="w-full rounded-xl bg-red-500/15 px-4 py-3 text-center text-sm text-red-400">
            ❌ {deleteError}
          </div>
        )}

        <div className="flex w-full gap-3">
          <button
            onClick={() => { setPendingBulkIds([]); setDeleteError(null); haptic('light'); }}
            disabled={deleteLoading}
            className="flex-1 rounded-2xl bg-tg-secondary-bg py-4 text-base font-bold text-tg-text active:scale-95 disabled:opacity-50"
          >
            Bekor
          </button>
          <button
            onClick={() => executeDelete(pendingBulkIds)}
            disabled={deleteLoading}
            className="flex-1 rounded-2xl bg-red-500 py-4 text-base font-bold text-white active:scale-95 disabled:opacity-50"
          >
            {deleteLoading ? '⏳ ...' : "Ha, o'chirish"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4 pb-32">
      {/* Sarlavha */}
      <div className="flex items-start justify-between px-1 pb-1 gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-bold truncate">{spec.title}</h2>
          <p className="text-xs text-tg-hint">{visibleItems.length} ta mahsulot</p>
        </div>
        {!readOnly && visibleItems.length > 0 && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => openPdfUrl(`/admin/products/specs/${spec.spec_id}/labels-pdf`)}
              className="rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-semibold text-emerald-400 active:scale-95"
            >
              🖨️
            </button>
            {!selectMode && (
              <button
                onClick={() => { haptic('light'); setPendingBulkIds(visibleItems.map((i) => i.id)); }}
                className="rounded-lg bg-red-500/15 px-2.5 py-1.5 text-xs font-semibold text-red-400 active:scale-95"
              >
                🗑 Barchasi
              </button>
            )}
            <button
              onClick={() => { setSelectMode((v) => !v); setSelectedIds(new Set()); haptic('light'); }}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all
                ${selectMode ? 'bg-red-500 text-white' : 'bg-tg-secondary-bg text-tg-text'}`}
            >
              {selectMode ? '✕' : '☑'}
            </button>
          </div>
        )}
      </div>

      {/* Barchasini belgilash satri */}
      {selectMode && visibleItems.length > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-tg-secondary-bg px-4 py-2.5">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => {
                if (allSelected) setSelectedIds(new Set());
                else setSelectedIds(new Set(visibleItems.map((i) => i.id)));
                haptic('light');
              }}
              className="h-4 w-4 accent-tg-button"
            />
            {allSelected ? 'Barchasini bekor' : 'Barchasini belgilash'}
          </label>
          {selectedIds.size > 0 && (
            <span className="text-xs font-semibold text-tg-button">{selectedIds.size} ta tanlandi</span>
          )}
        </div>
      )}

      {visibleItems.length === 0 && (
        <EmptyState icon="📦" title="Mahsulot topilmadi" />
      )}

      {/* Mahsulotlar ro'yxati */}
      {visibleItems.map((item) => (
        <Card
          key={item.id}
          className={`transition-all
            ${selectMode
              ? 'cursor-pointer active:scale-[0.98] ' + (selectedIds.has(item.id) ? 'ring-2 ring-tg-button' : '')
              : ''}`}
          onClick={() => {
            if (selectMode) { toggleSelect(item.id); haptic('light'); }
          }}
        >
          <div className="flex items-center gap-3">
            {/* Checkbox (select mode) */}
            {selectMode && (
              <input
                type="checkbox"
                checked={selectedIds.has(item.id)}
                onChange={() => toggleSelect(item.id)}
                onClick={(e) => e.stopPropagation()}
                className="h-5 w-5 flex-shrink-0 accent-tg-button"
              />
            )}
            {/* Barcode icon */}
            <div
              className="flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg bg-tg-secondary-bg text-xl active:opacity-70"
              onClick={(e) => { e.stopPropagation(); haptic('light'); onSelect(item); }}
            >
              〓
            </div>
            {/* Ma'lumot */}
            <div
              className="min-w-0 flex-1 cursor-pointer active:opacity-70"
              onClick={(e) => { if (!selectMode) { e.stopPropagation(); haptic('light'); onSelect(item); } }}
            >
              <p className="font-mono font-bold tracking-wider">{item.short_code}</p>
              <div className="mt-0.5 flex items-center gap-1 flex-wrap">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold
                  ${STATUS_COLORS[item.status] ?? 'bg-white/5 text-tg-hint'}`}>
                  {STATUS_LABELS[item.status] ?? item.status}
                </span>
                {item.label_printed
                  ? <span className="text-xs text-emerald-400">🏷️ chop</span>
                  : <span className="text-xs text-tg-hint">🏷️ —</span>
                }
              </div>
            </div>
            {/* O'chirish (select mode emas) */}
            {!readOnly && !selectMode && (
              confirmOneId === item.id ? (
                <div className="flex flex-shrink-0 gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); executeDelete([item.id]); }}
                    className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white active:scale-95"
                  >
                    Ha
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmOneId(null); haptic('light'); }}
                    className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-tg-hint active:scale-95"
                  >
                    Yo'q
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmOneId(item.id); haptic('warning'); }}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-lg text-red-400 active:scale-95"
                >
                  🗑
                </button>
              )
            )}
          </div>
        </Card>
      ))}

      {/* Bulk panel (pastki qism) */}
      {/* Select mode: PDF + O'chirish tugmasi */}
      {selectMode && selectedIds.size > 0 && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => openPdfUrl(`/admin/products/labels-pdf?ids=${encodeURIComponent([...selectedIds].join(','))}`)}
            className="flex-1 rounded-xl bg-green-500 py-3 text-sm font-semibold text-white active:scale-95"
          >
            🖨️ {selectedIds.size} ta PDF
          </button>
          <button
            onClick={() => { haptic('warning'); setPendingBulkIds([...selectedIds]); }}
            className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-semibold text-white active:scale-95"
          >
            🗑 {selectedIds.size} ta o'chir
          </button>
        </div>
      )}

    </div>
  );
}

// ─── View 3 — QR kod ──────────────────────────────────────────────────────────

function QrView({
  item,
  specTitle,
  onBack,
  readOnly = false,
}: {
  item: ProductItem;
  specTitle: string;
  onBack: () => void;
  readOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  useBackButton(onBack);

  const { data: qrData, isLoading } = useQuery<ProductQr>({
    queryKey: ['product-qr', item.id],
    queryFn: async () => {
      const { data } = await api.get<ProductQr>(`/admin/products/${item.id}/qr`);
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/admin/products/${item.id}`);
    },
    onSuccess: () => {
      haptic('success');
      queryClient.invalidateQueries({ queryKey: ['admin-spec-items'] });
      queryClient.invalidateQueries({ queryKey: ['admin-product-specs'] });
      onBack();
    },
    onError: () => haptic('error'),
  });

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="flex flex-col items-center gap-4 p-4 pb-24">
      {/* Sarlavha */}
      <div className="w-full text-center">
        <h2 className="text-lg font-bold">{specTitle}</h2>
        <p className="font-mono text-2xl font-black tracking-widest text-tg-button">
          {item.short_code}
        </p>
      </div>

      {/* Status */}
      <span className={`rounded-full px-3 py-1 text-sm font-semibold
        ${STATUS_COLORS[item.status] ?? 'bg-white/5 text-tg-hint'}`}>
        {STATUS_LABELS[item.status] ?? item.status}
      </span>

      {/* Barcode rasm */}
      {qrData && (
        <div className="w-full rounded-2xl bg-tg-sectionBg p-5 shadow-md">
          <img
            src={`data:image/png;base64,${qrData.qr_image_b64}`}
            alt={item.short_code}
            className="w-full rounded"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
      )}

      {/* Label holati */}
      <div className="w-full rounded-xl bg-tg-secondary-bg px-4 py-3 text-center">
        {item.label_printed
          ? <span className="text-sm font-medium text-emerald-400">🏷️ Label chop etilgan</span>
          : <span className="text-sm text-tg-hint">🏷️ Label chop etilmagan</span>
        }
      </div>

      {/* O'chirish — bir tugma */}
      {!readOnly && (
        <button
          onClick={() => { haptic('warning'); deleteMutation.mutate(); }}
          disabled={deleteMutation.isPending}
          className="w-full rounded-xl bg-red-500 py-3 text-sm font-semibold text-white active:scale-95 disabled:opacity-50"
        >
          {deleteMutation.isPending ? '⏳ O\'chirilmoqda...' : '🗑 Mahsulotni o\'chirish'}
        </button>
      )}
    </div>
  );
}

// ─── Main export — navigatsiya boshqaruvchi ───────────────────────────────────

type View =
  | { type: 'specs' }
  | { type: 'items'; spec: SpecGroup }
  | { type: 'qr'; spec: SpecGroup; item: ProductItem };

export default function AdminProducts({ readOnly = false }: { readOnly?: boolean }) {
  const [view, setView] = useState<View>({ type: 'specs' });

  if (view.type === 'specs') {
    return (
      <SpecsView
        readOnly={readOnly}
        onSelect={(spec) => setView({ type: 'items', spec })}
      />
    );
  }

  if (view.type === 'items') {
    return (
      <ItemsView
        spec={view.spec}
        readOnly={readOnly}
        onBack={() => setView({ type: 'specs' })}
        onSelect={(item) => setView({ type: 'qr', spec: view.spec, item })}
      />
    );
  }

  return (
    <QrView
      item={view.item}
      specTitle={view.spec.title}
      readOnly={readOnly}
      onBack={() => setView({ type: 'items', spec: view.spec })}
    />
  );
}
