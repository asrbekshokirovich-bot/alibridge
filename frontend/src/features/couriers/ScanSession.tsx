import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, extractErrorMessage } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { useBackButton, haptic } from '@shared/hooks/useTelegram';
import { useScanner } from '@shared/hooks/useScanner';

interface ScannedItem {
  short_code: string;
  ok: boolean;
  info: string;
}

interface UserProfile {
  roles: string[];
}

export default function CourierScanSession() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [scanned, setScanned] = useState<ScannedItem[]>([]);
  const [lastQr, setLastQr] = useState<string | null>(null);

  useBackButton(() => navigate(-1));

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await api.get<UserProfile>('/profile/me');
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const isTrCourier = profile?.roles?.includes('courier_tr') ?? false;
  const title = isTrCourier ? '✈️ Yo\'lovchidan qabul' : '📦 Ombordan olish';

  const scanMutation = useMutation({
    mutationFn: async (qr: string) => {
      if (isTrCourier) {
        const { data } = await api.post<{ short_code: string; carrier_name: string | null }>('/scan', {
          qr_payload: qr,
          context: 'COURIER_TR_RECEIVE',
        });
        return {
          short_code: data.short_code ?? '—',
          info: data.carrier_name ? `Yo'lovchi: ${data.carrier_name}` : 'Qabul qilindi',
        };
      } else {
        const { data } = await api.post<{ short_code: string; spec_title: string }>('/courier/pickup', {
          qr_payload: qr,
        });
        return {
          short_code: data.short_code,
          info: data.spec_title,
        };
      }
    },
    onSuccess: (data) => {
      haptic('success');
      setScanned((prev) => [{ short_code: data.short_code, ok: true, info: data.info }, ...prev]);
      queryClient.invalidateQueries({ queryKey: ['courier-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dispatch-queue'] });
    },
    onError: (error) => {
      haptic('error');
      setScanned((prev) => [
        { short_code: '—', ok: false, info: extractErrorMessage(error) },
        ...prev,
      ]);
    },
  });

  const { scannerRef, isScanning, startScan, stopScan } = useScanner({
    onScan: (qr) => {
      if (qr === lastQr) return;
      setLastQr(qr);
      scanMutation.mutate(qr);
      setTimeout(() => setLastQr(null), 1500);
    },
  });

  const okCount = scanned.filter((s) => s.ok).length;
  const errCount = scanned.filter((s) => !s.ok).length;

  return (
    <div className="space-y-3 p-4 pb-24">
      <h2 className="px-1 text-lg font-bold">{title}</h2>

      {/* Skaner */}
      <Card>
        <div ref={scannerRef} className="overflow-hidden rounded-lg" style={{ minHeight: 200 }} />
        <div className="mt-3 flex items-center gap-2">
          {!isScanning ? (
            <Button fullWidth onClick={startScan}>
              📷 Skanerlashni boshlash
            </Button>
          ) : (
            <Button fullWidth variant="secondary" onClick={stopScan}>
              ⏹ To'xtatish
            </Button>
          )}
          <div className="flex gap-1 flex-shrink-0">
            <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-sm font-bold text-emerald-400">
              ✓ {okCount}
            </span>
            {errCount > 0 && (
              <span className="rounded-lg bg-red-500/20 px-2.5 py-1.5 text-sm font-bold text-red-400">
                ✗ {errCount}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Queue ga o'tish */}
      {okCount > 0 && (
        <Button fullWidth size="lg" onClick={() => navigate('/couriers/queue')}>
          📋 Yuklarimga o'tish ({okCount} ta qabul qilindi)
        </Button>
      )}

      {/* Skanerlangan ro'yxat */}
      {scanned.length > 0 && (
        <div className="space-y-2">
          <p className="px-1 text-xs text-tg-hint font-medium">Skanerlangan mahsulotlar</p>
          {scanned.map((item, idx) => (
            <Card key={idx} className={`py-2.5 ${!item.ok ? 'border border-white/10' : 'border border-white/10'}`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{item.ok ? '✅' : '❌'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-bold text-sm">{item.short_code}</p>
                  <p className={`text-xs ${item.ok ? 'text-emerald-400' : 'text-red-500'}`}>
                    {item.info}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {scanned.length === 0 && !isScanning && (
        <Card>
          <p className="text-center text-sm text-tg-hint py-2">
            Mahsulot QR kodini skanerlang
          </p>
        </Card>
      )}
    </div>
  );
}
