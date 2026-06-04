/**
 * Mijoz qabul — AT_TR_WH mahsulotlarni mijozga topshirish.
 *
 * Zanjirning oxirgi qadami:
 *   WH_TR xodimi skanerlaydi yoki ro'yxatdan belgilaydi
 *   → POST /warehouse/tr/customer-pickup/{id}
 *   → AT_TR_WH → DELIVERED
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api, extractErrorMessage } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { useBackButton, haptic } from '@shared/hooks/useTelegram';
import { useScanner } from '@shared/hooks/useScanner';

interface ReadyProduct {
  id: string;
  short_code: string;
  spec_title: string;
  orderer_name: string;
}

type Tab = 'list' | 'scan';

export default function WarehouseTrCustomerPickup() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('list');
  const [lastQr, setLastQr] = useState<string | null>(null);
  const [scanLog, setScanLog] = useState<Array<{ short_code: string; ok: boolean; msg: string }>>([]);

  useBackButton(() => navigate(-1));

  // Tayyor mahsulotlar ro'yxati
  const { data: products, isLoading } = useQuery<ReadyProduct[]>({
    queryKey: ['tr-ready-pickup'],
    queryFn: async () => {
      const { data } = await api.get<ReadyProduct[]>('/warehouse/tr/ready');
      return data;
    },
  });

  // Bitta mahsulotni DELIVERED qilish
  const pickupMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { data } = await api.post<{ short_code: string }>(
        `/warehouse/tr/customer-pickup/${productId}`
      );
      return data;
    },
    onSuccess: (data) => {
      haptic('success');
      queryClient.invalidateQueries({ queryKey: ['tr-ready-pickup'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-tr-stats'] });
      setScanLog((prev) => [
        { short_code: data.short_code, ok: true, msg: '✓ Mijozga topshirildi' },
        ...prev,
      ]);
    },
    onError: (error, productId) => {
      haptic('error');
      setScanLog((prev) => [
        { short_code: productId.slice(0, 8) + '…', ok: false, msg: extractErrorMessage(error) },
        ...prev,
      ]);
    },
  });

  const qrPickupMutation = useMutation({
    mutationFn: async (qr: string) => {
      const { data } = await api.post<{ short_code: string }>(
        '/warehouse/tr/customer-pickup-qr',
        { qr_payload: qr },
      );
      return data;
    },
    onSuccess: (data) => {
      haptic('success');
      queryClient.invalidateQueries({ queryKey: ['tr-ready-pickup'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-tr-stats'] });
      setScanLog((prev) => [
        { short_code: data.short_code, ok: true, msg: '✓ Mijozga topshirildi' },
        ...prev,
      ]);
    },
    onError: (error, qr) => {
      haptic('error');
      setScanLog((prev) => [
        { short_code: qr.slice(0, 10), ok: false, msg: extractErrorMessage(error) },
        ...prev,
      ]);
    },
  });

  const { scannerRef, isScanning, startScan, stopScan } = useScanner({
    onScan: (qr) => {
      if (qr === lastQr) return;
      setLastQr(qr);
      qrPickupMutation.mutate(qr);
      setTimeout(() => setLastQr(null), 1500);
    },
  });

  if (isLoading) return <LoadingScreen />;

  const okCount = scanLog.filter((l) => l.ok).length;

  return (
    <div className="space-y-3 p-4 pb-20">
      <h2 className="px-1 text-lg font-bold">👤 Mijoz qabul</h2>
      <p className="px-1 text-sm text-tg-hint">
        Mijoz kelib yukini olganda uning mahsulotini DELIVERED deb belgilang
      </p>

      {/* Tab bar */}
      <div className="flex gap-2">
        {(['list', 'scan'] as Tab[]).map((t_) => (
          <button
            key={t_}
            onClick={() => setTab(t_)}
            className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
              tab === t_
                ? 'bg-tg-button text-tg-button-text'
                : 'bg-tg-secondary-bg text-tg-hint'
            }`}
          >
            {t_ === 'list' ? '📋 Ro\'yxat' : '📷 Skaner'}
          </button>
        ))}
      </div>

      {/* ── RO'YXAT TAB ──────────────────────────────────────────────── */}
      {tab === 'list' && (
        <>
          {!products || products.length === 0 ? (
            <Card>
              <p className="text-center text-sm text-tg-hint">
                Omborда hech qanday mahsulot yo'q
              </p>
            </Card>
          ) : (
            products.map((item) => (
              <Card key={item.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-bold">{item.short_code}</p>
                    <p className="truncate text-sm">{item.spec_title}</p>
                    <p className="text-xs text-tg-hint">👤 {item.orderer_name}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    loading={pickupMutation.isPending && pickupMutation.variables === item.id}
                    onClick={() => pickupMutation.mutate(item.id)}
                  >
                    ✓ Topshirdi
                  </Button>
                </div>
              </Card>
            ))
          )}
        </>
      )}

      {/* ── SKANER TAB ───────────────────────────────────────────────── */}
      {tab === 'scan' && (
        <>
          <Card>
            <div ref={scannerRef} className="overflow-hidden rounded-lg" style={{ minHeight: 220 }} />
            <div className="mt-2 flex items-center gap-2">
              {!isScanning ? (
                <Button fullWidth onClick={startScan}>
                  📷 {t('scan.start')}
                </Button>
              ) : (
                <Button fullWidth variant="secondary" onClick={stopScan}>
                  ⏹ {t('scan.stop')}
                </Button>
              )}
              {okCount > 0 && (
                <span className="flex-shrink-0 rounded-lg bg-emerald-500/20 px-3 py-2 text-sm font-bold text-emerald-400">
                  ✓ {okCount}
                </span>
              )}
            </div>
          </Card>

          {scanLog.map((entry, idx) => (
            <Card key={idx} className={`py-2 ${!entry.ok ? 'border border-white/10' : ''}`}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-mono font-semibold">{entry.short_code}</span>
                <span className={entry.ok ? 'text-green-500' : 'text-red-500'}>{entry.msg}</span>
              </div>
            </Card>
          ))}

          {scanLog.length === 0 && !isScanning && (
            <Card>
              <p className="text-center text-sm text-tg-hint">
                Mahsulot QR kodini skanerlang
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
