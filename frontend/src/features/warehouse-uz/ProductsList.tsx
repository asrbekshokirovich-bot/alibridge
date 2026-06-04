import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { ProductThumb } from '@shared/components/ProductThumb';
import { useBackButton, haptic } from '@shared/hooks/useTelegram';
import { useAuthStore } from '@shared/store/auth';

async function openPdf(specId: string) {
  if (!useAuthStore.getState().token) { alert('Avval login qiling'); return; }
  try {
    // H1: qisqa muddatli download token (sessiya tokeni URL'ga qo'yilmaydi)
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

interface Spec {
  spec_id: string;
  title: string;
  photo: string | null;
  sourcing_mode: string;
  box_items_count: number | null;
  total_weight_g: number;
  count: number;
  last_created: string | null;
}

const MODE_UNIT: Record<string, string> = { piece: 'dona', box: 'quti', textile: "to'plam" };

interface WarehouseProduct {
  id: string;
  short_code: string;
  status: string;
  unit_weight_g: number;
  label_printed: boolean;
  created_at: string | null;
  qr_payload: string;
}

// ── Specs ro'yxati ─────────────────────────────────────────────────────────────
function SpecsView({ onSelect }: { onSelect: (spec: Spec) => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useBackButton(() => navigate(-1));

  const [confirmSpec, setConfirmSpec] = useState<Spec | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletedSpecIds, setDeletedSpecIds] = useState<Set<string>>(new Set());
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<Spec[]>({
    queryKey: ['wh-specs'],
    queryFn: async () => {
      const { data } = await api.get<Spec[]>('/warehouse/uz/products/specs');
      return data;
    },
  });

  const handleDeleteSpec = async (spec: Spec) => {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const { data } = await api.delete<{ products_count: number; remaining: number }>(
        `/warehouse/uz/products/specs/${spec.spec_id}`
      );
      haptic('success');
      // Carrier olib ketgan mahsulot qolsa katalog ro'yxatda qoladi (backend guard).
      if (data.remaining > 0) {
        setDeleteError(
          `${data.products_count} ta o'chirildi. ${data.remaining} ta yo'lovchida bo'lgani uchun katalog saqlandi.`
        );
        queryClient.invalidateQueries({ queryKey: ['wh-specs'] });
        setConfirmSpec(null);
      } else {
        setDeletedSpecIds((prev) => new Set([...prev, spec.spec_id]));
        setConfirmSpec(null);
        queryClient.invalidateQueries({ queryKey: ['wh-specs'] });
      }
    } catch (err: unknown) {
      haptic('error');
      setDeleteError((err as any)?.response?.data?.error?.message || "O'chirishda xatolik");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (isLoading) return <LoadingScreen />;

  // To'liq ekran tasdiqlash
  if (confirmSpec) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6">
        <div className="text-5xl">🗑️</div>
        <p className="text-center text-lg font-bold text-tg-text">
          "{confirmSpec.title}" katalogi o'chirilsinmi?
        </p>
        <p className="text-center text-sm text-tg-hint">
          Ombordagi {confirmSpec.count} ta mahsulot o'chiriladi
        </p>
        {deleteError && (
          <div className="w-full rounded-xl bg-amber-500/15 px-4 py-3 text-center text-sm text-amber-300">
            ⚠️ {deleteError}
          </div>
        )}
        <div className="flex w-full gap-3">
          <button
            onClick={() => { setConfirmSpec(null); setDeleteError(null); haptic('light'); }}
            className="flex-1 rounded-xl bg-white/10 py-3 font-bold text-tg-text"
          >
            Bekor
          </button>
          <button
            onClick={() => handleDeleteSpec(confirmSpec)}
            disabled={deleteLoading}
            className="flex-1 rounded-xl bg-red-500 py-3 font-bold text-white active:opacity-70"
          >
            {deleteLoading ? '⏳ ...' : "Ha, o'chirish"}
          </button>
        </div>
      </div>
    );
  }

  const visible = (data ?? []).filter((s) => !deletedSpecIds.has(s.spec_id));

  return (
    <div className="space-y-3 p-4 pb-20">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-bold">Mahsulotlar</h2>
        <span className="text-sm text-tg-hint">{visible.length} katalog</span>
      </div>

      {deleteError && (
        <div className="flex items-start justify-between gap-2 rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-amber-300">
          <span>⚠️ {deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="shrink-0 text-amber-300/70">✕</button>
        </div>
      )}

      {visible.length === 0 ? (
        <Card><p className="text-center text-sm text-tg-hint">Ombor bo'sh</p></Card>
      ) : (
        visible.map((spec) => (
          <Card key={spec.spec_id}>
            <div className="flex items-center justify-between">
              <div
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
                onClick={() => { haptic('light'); onSelect(spec); }}
              >
                <ProductThumb src={spec.photo} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{spec.title}</p>
                  {spec.sourcing_mode !== 'piece' && spec.box_items_count ? (
                    <p className="text-xs font-medium text-tg-button">
                      {spec.sourcing_mode === 'textile' ? '🧵' : '📦'} {spec.box_items_count} dona/{MODE_UNIT[spec.sourcing_mode]} · {(spec.total_weight_g / 1000).toFixed(1)} kg
                    </p>
                  ) : null}
                  {spec.last_created && (
                    <p className="text-xs text-tg-hint">
                      {new Date(spec.last_created).toLocaleDateString('uz-UZ')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="cursor-pointer text-right"
                  onClick={() => { haptic('light'); onSelect(spec); }}
                >
                  <p className="text-2xl font-bold text-tg-button">{spec.count}</p>
                  <p className="text-xs text-tg-hint">{MODE_UNIT[spec.sourcing_mode] ?? 'dona'}</p>
                </div>
                <button
                  onClick={() => { haptic('light'); setConfirmSpec(spec); }}
                  className="rounded-lg bg-red-500 px-2 py-1 text-sm text-white active:opacity-70"
                >
                  🗑
                </button>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

// ── Katalog ichidagi mahsulotlar ───────────────────────────────────────────────
function ItemsView({ spec, onBack }: { spec: Spec; onBack: () => void }) {
  useBackButton(onBack);
  const queryClient = useQueryClient();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [qrLoading, setQrLoading] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery<WarehouseProduct[]>({
    queryKey: ['wh-spec-items', spec.spec_id],
    queryFn: async () => {
      const { data } = await api.get<WarehouseProduct[]>(
        `/warehouse/uz/products/specs/${spec.spec_id}/items`
      );
      return data;
    },
    staleTime: 0,
    retry: 1,
  });

  const loadQr = async (productId: string) => {
    if (qrImages[productId]) {
      setExpandedId(expandedId === productId ? null : productId);
      return;
    }
    setQrLoading(productId);
    try {
      const { data } = await api.get<{ qr_image_b64: string }>(
        `/warehouse/uz/products/${productId}/qr`
      );
      setQrImages((prev) => ({ ...prev, [productId]: data.qr_image_b64 }));
      setExpandedId(productId);
    } finally {
      setQrLoading(null);
    }
  };

  const handleDelete = async (productId: string) => {
    setDeleteLoading(true);
    setBulkDeleteError(null);
    try {
      await api.delete(`/warehouse/uz/products/${productId}`);
      haptic('success');
      setDeletedIds((prev) => new Set([...prev, productId]));
      setConfirmDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['wh-specs'] });
      queryClient.invalidateQueries({ queryKey: ['wh-spec-items', spec.spec_id] });
    } catch (err: unknown) {
      haptic('error');
      setConfirmDeleteId(null);
      setBulkDeleteError(
        (err as any)?.response?.data?.error?.message ||
        "Bu mahsulot omborda emas — o'chirib bo'lmaydi"
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    const ids = (data ?? []).filter((p) => !deletedIds.has(p.id)).map((p) => p.id);
    if (ids.length === 0) return;
    setDeleteLoading(true);
    setBulkDeleteError(null);
    try {
      const { data: res } = await api.delete<{ deleted: number; skipped: number }>(
        `/warehouse/uz/products/bulk?ids=${encodeURIComponent(ids.join(','))}`
      );
      haptic('success');
      queryClient.invalidateQueries({ queryKey: ['wh-specs'] });
      queryClient.invalidateQueries({ queryKey: ['wh-spec-items', spec.spec_id] });
      // Carrier olib ketganlar o'tkazib yuboriladi (backend guard).
      if (res.skipped > 0) {
        setDeletedIds((prev) => new Set([...prev, ...ids]));
        setBulkDeleteError(
          `${res.deleted} ta o'chirildi. ${res.skipped} ta yo'lovchida bo'lgani uchun o'chmadi.`
        );
        refetch();
      } else {
        setDeletedIds((prev) => new Set([...prev, ...ids]));
        setConfirmBulkDelete(false);
      }
    } catch (err: unknown) {
      haptic('error');
      setBulkDeleteError((err as any)?.response?.data?.error?.message || 'Xato yuz berdi');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (isLoading) return <LoadingScreen />;

  if (isError) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <p className="text-center text-lg font-bold">{spec.title}</p>
        <div className="rounded-xl bg-red-500/15 p-4 text-center text-sm text-red-400">
          ❌ {(error as any)?.response?.data?.error?.message || (error as any)?.message || 'Serverdan javob kelmadi'}
        </div>
        <button
          onClick={() => refetch()}
          className="rounded-xl bg-tg-button py-3 text-sm font-bold text-white"
        >
          🔄 Qayta urinish
        </button>
      </div>
    );
  }

  const visible = (data ?? []).filter((p) => !deletedIds.has(p.id));

  // To'liq ekran — bulk delete tasdiqlash
  if (confirmBulkDelete) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6">
        <div className="text-5xl">🗑️</div>
        <p className="text-center text-lg font-bold text-tg-text">
          {visible.length} ta mahsulot o'chirilsinmi?
        </p>
        <p className="text-center text-sm text-tg-hint">{spec.title}</p>
        {bulkDeleteError && (
          <div className="w-full rounded-xl bg-red-500/15 px-4 py-3 text-center text-sm text-red-400">
            ❌ {bulkDeleteError}
          </div>
        )}
        <div className="flex w-full gap-3">
          <button
            onClick={() => { setConfirmBulkDelete(false); setBulkDeleteError(null); haptic('light'); }}
            className="flex-1 rounded-xl bg-white/10 py-3 font-bold text-tg-text"
          >
            Bekor
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={deleteLoading}
            className="flex-1 rounded-xl bg-red-500 py-3 font-bold text-white active:opacity-70"
          >
            {deleteLoading ? '⏳ ...' : "Ha, o'chirish"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 pb-20">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-lg font-bold">{spec.title}</h2>
          <p className="text-sm text-tg-hint">{visible.length} ta mahsulot</p>
        </div>
        <button
          onClick={() => { haptic('light'); setConfirmBulkDelete(true); }}
          className="rounded-xl bg-red-500 px-3 py-2 text-xs font-bold text-white active:opacity-70"
        >
          🗑 Barchasi
        </button>
      </div>

      {/* Chop etish tugmasi */}
      <button
        onClick={() => { haptic('light'); openPdf(spec.spec_id); }}
        className="w-full rounded-xl bg-tg-button py-3 text-sm font-bold text-tg-button-text active:opacity-70"
      >
        🖨️ Barchasini chop etish (PDF)
      </button>

      {bulkDeleteError && (
        <div className="flex items-start justify-between gap-2 rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-amber-300">
          <span>⚠️ {bulkDeleteError}</span>
          <button onClick={() => setBulkDeleteError(null)} className="shrink-0 text-amber-300/70">✕</button>
        </div>
      )}

      {visible.length === 0 && !isLoading ? (
        <Card><p className="text-center text-sm text-tg-hint">Mahsulot topilmadi</p></Card>
      ) : (
        visible.map((item, idx) => (
          <Card key={item.id}>
            {/* Asosiy qator */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium">
                  #{idx + 1} — <span className="font-mono">{item.short_code}</span>
                </p>
                <p className="text-xs text-tg-hint">{item.unit_weight_g}g</p>
              </div>
              <div className="flex items-center gap-2">
                {/* QR tugma */}
                <button
                  onClick={() => loadQr(item.id)}
                  className="rounded-lg bg-blue-500 px-3 py-1 text-xs text-white active:opacity-70"
                >
                  {qrLoading === item.id ? '⏳' : expandedId === item.id ? '✕ QR' : '📷 QR'}
                </button>

                {/* Delete tugma */}
                {confirmDeleteId === item.id ? (
                  <div className="flex gap-1">
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded-lg bg-white/10 px-2 py-1 text-xs text-tg-text"
                    >
                      Yo'q
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deleteLoading}
                      className="rounded-lg bg-red-500 px-2 py-1 text-xs text-white active:opacity-70"
                    >
                      {deleteLoading ? '⏳' : 'Ha'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { haptic('light'); setConfirmDeleteId(item.id); }}
                    className="rounded-lg bg-red-500 px-3 py-1 text-xs text-white active:opacity-70"
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>

            {/* Label holati */}
            <div className="mt-1">
              {item.label_printed ? (
                <span className="text-xs text-green-500">🖨️ Bosilgan</span>
              ) : (
                <span className="text-xs text-orange-400">⏳ Label yo'q</span>
              )}
            </div>

            {/* QR rasm */}
            {expandedId === item.id && qrImages[item.id] && (
              <div className="mt-3 flex justify-center">
                <img
                  src={`data:image/png;base64,${qrImages[item.id]}`}
                  alt="QR kod"
                  className="h-40 w-40 rounded-lg border border-tg-hint"
                />
              </div>
            )}
          </Card>
        ))
      )}

    </div>
  );
}

// ── Asosiy komponent ───────────────────────────────────────────────────────────
export default function WarehouseProductsList() {
  const [selectedSpec, setSelectedSpec] = useState<Spec | null>(null);

  if (selectedSpec) {
    return <ItemsView spec={selectedSpec} onBack={() => setSelectedSpec(null)} />;
  }
  return <SpecsView onSelect={setSelectedSpec} />;
}
