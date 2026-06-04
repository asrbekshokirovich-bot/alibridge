/**
 * LabelPrint — ombor QR yorliq bosish ekrani
 *
 * Oqim:
 *  1. Spec (mahsulot turi) ro'yxati yuklaydi
 *  2. Spec bosilganda uning mahsulotlari ochiladi
 *  3. Mahsulot bosilganda QR kod yuklanadi
 *  4. "Chop etildi" belgisi qo'yiladi → katalogda ko'rinadi
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, extractErrorMessage } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { useBackButton, haptic } from '@shared/hooks/useTelegram';

interface Spec {
  spec_id: string;
  title: string;
  count: number;
  last_created: string | null;
}

interface ProductItem {
  id: string;
  short_code: string;
  unit_weight_g: number;
  label_printed: boolean;
}

interface QrData {
  qr_image_b64: string;
  short_code: string;
}

export default function WarehouseUzLabelPrint() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [openSpec, setOpenSpec] = useState<string | null>(null);
  const [qrCache, setQrCache] = useState<Record<string, QrData>>({});
  const [openQr, setOpenQr] = useState<string | null>(null);
  const [filter] = useState<'all' | 'pending'>('pending');

  useBackButton(() => navigate(-1));

  // ── Spec ro'yxati ─────────────────────────────────────────────────────────
  const { data: specs, isLoading } = useQuery<Spec[]>({
    queryKey: ['label-specs'],
    queryFn: async () => {
      const { data } = await api.get<Spec[]>('/warehouse/uz/products/specs');
      return data;
    },
  });

  // ── Ochiq spec mahsulotlari ───────────────────────────────────────────────
  const { data: specItems } = useQuery<ProductItem[]>({
    queryKey: ['label-spec-items', openSpec],
    enabled: !!openSpec,
    queryFn: async () => {
      const { data } = await api.get<ProductItem[]>(
        `/warehouse/uz/products/specs/${openSpec}/items`
      );
      return data;
    },
  });

  // ── QR yuklash ────────────────────────────────────────────────────────────
  const loadQr = async (productId: string) => {
    if (qrCache[productId]) {
      setOpenQr(productId);
      return;
    }
    try {
      const { data } = await api.get<QrData>(`/warehouse/uz/products/${productId}/qr`);
      setQrCache((c) => ({ ...c, [productId]: data }));
      setOpenQr(productId);
    } catch {
      alert('QR yuklanmadi');
    }
  };

  // ── Label belgilash ───────────────────────────────────────────────────────
  const printMutation = useMutation({
    mutationFn: async (productId: string) => {
      await api.post(`/warehouse/uz/products/${productId}/mark-printed`);
    },
    onSuccess: () => {
      haptic('success');
      queryClient.invalidateQueries({ queryKey: ['label-spec-items', openSpec] });
      queryClient.invalidateQueries({ queryKey: ['label-specs'] });
      setOpenQr(null);
    },
    onError: (e) => { haptic('error'); alert(extractErrorMessage(e)); },
  });

  // ── Barcha labellarni belgilash ───────────────────────────────────────────
  const printAllMutation = useMutation({
    mutationFn: async (items: ProductItem[]) => {
      const unlabeled = items.filter((i) => !i.label_printed);
      await Promise.all(
        unlabeled.map((i) => api.post(`/warehouse/uz/products/${i.id}/mark-printed`))
      );
    },
    onSuccess: () => {
      haptic('success');
      queryClient.invalidateQueries({ queryKey: ['label-spec-items', openSpec] });
      queryClient.invalidateQueries({ queryKey: ['label-specs'] });
    },
    onError: (e) => { haptic('error'); alert(extractErrorMessage(e)); },
  });

  if (isLoading) return <LoadingScreen />;

  const totalPending = specs?.reduce(
    (s, sp) => s + sp.count, 0
  ) ?? 0;

  return (
    <div className="flex flex-col gap-3 p-4 pb-20">

      {/* Sarlavha */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">🖨️ Labellar</h2>
        <span className="rounded-full bg-accent-amber/20 px-3 py-0.5 text-xs font-semibold text-accent-amber">
          {totalPending} ta mahsulot
        </span>
      </div>

      {/* Izoh */}
      <Card>
        <p className="text-xs text-tg-hint leading-relaxed">
          Har bir mahsulotga QR sticker bosib yopishtiriladi.
          QR kodni ko'rsatish uchun mahsulot kodni bosing, chop etgach ✅ belgisini qo'ying.
        </p>
      </Card>

      {/* Spec ro'yxati */}
      {!specs || specs.length === 0 ? (
        <Card>
          <p className="text-center text-sm text-tg-hint py-4">
            ✅ Barcha labellar bosilgan
          </p>
        </Card>
      ) : (
        specs.map((spec) => (
          <div key={spec.spec_id}>
            {/* Spec sarlavhasi */}
            <Card
              className="cursor-pointer active:scale-95"
              onClick={() => setOpenSpec(openSpec === spec.spec_id ? null : spec.spec_id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{spec.title}</p>
                  <p className="text-xs text-tg-hint mt-0.5">
                    {spec.count} ta mahsulot
                  </p>
                </div>
                <span className="text-tg-hint text-lg">
                  {openSpec === spec.spec_id ? '▲' : '▼'}
                </span>
              </div>
            </Card>

            {/* Spec mahsulotlari */}
            {openSpec === spec.spec_id && specItems && (
              <div className="ml-3 mt-1 space-y-1.5 border-l-2 border-tg-button/20 pl-3">
                {specItems.some((i) => !i.label_printed) && (
                  <Button
                    fullWidth
                    size="sm"
                    loading={printAllMutation.isPending}
                    onClick={() => printAllMutation.mutate(specItems)}
                  >
                    ✅ Hammasini belgilash
                  </Button>
                )}
                {specItems
                  .filter(item => filter === 'all' || !item.label_printed)
                  .map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl bg-tg-secondaryBg px-3 py-2"
                  >
                    <div>
                      <p className="font-mono text-sm font-semibold">#{item.short_code}</p>
                      <p className="text-xs text-tg-hint">{item.unit_weight_g} g</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.label_printed ? (
                        <span className="text-xs text-green-500 font-medium">✅ Bosilgan</span>
                      ) : (
                        <>
                          <button
                            className="rounded-lg bg-tg-secondaryBg border border-tg-button/30 px-2 py-1 text-xs active:opacity-70"
                            onClick={() => loadQr(item.id)}
                          >
                            📱 QR
                          </button>
                          <button
                            className="rounded-lg bg-green-500 px-2 py-1 text-xs text-white active:opacity-70"
                            onClick={() => {
                              haptic('light');
                              printMutation.mutate(item.id);
                            }}
                          >
                            ✅ Bosildi
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}

      {/* QR modal */}
      {openQr && qrCache[openQr] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
          onClick={() => setOpenQr(null)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-tg-sectionBg p-5 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-sm font-bold text-tg-text">
              #{qrCache[openQr].short_code}
            </p>
            <img
              src={`data:image/png;base64,${qrCache[openQr].qr_image_b64}`}
              alt="QR kod"
              className="mx-auto w-48 h-48"
            />
            <p className="mt-3 text-xs text-tg-hint">
              Rasmni saqlang va printer orqali bosib mahsulotga yopishtiging
            </p>
            <div className="mt-4 flex gap-2">
              <button
                className="flex-1 rounded-xl bg-white/5 py-2 text-sm text-tg-hint"
                onClick={() => setOpenQr(null)}
              >
                Yopish
              </button>
              <button
                className="flex-1 rounded-xl bg-green-500 py-2 text-sm text-white font-semibold"
                onClick={() => {
                  haptic('success');
                  printMutation.mutate(openQr);
                }}
              >
                ✅ Bosildi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
