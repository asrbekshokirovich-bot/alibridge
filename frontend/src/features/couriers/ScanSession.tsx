import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [scanned, setScanned] = useState<ScannedItem[]>([]);
  const [lastQr, setLastQr] = useState<string | null>(null);

  useBackButton(() => navigate(-1));

  // Qaysi rol ekanligini aniqlash
  const { data: profile } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await api.get<UserProfile>('/profile/me');
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 daqiqa cache
  });

  const isTrCourier = profile?.roles?.includes('courier_tr') ?? false;

  const scanMutation = useMutation({
    mutationFn: async (qr: string) => {
      if (isTrCourier) {
        // COURIER_TR: yo'lovchidan (carrierdan) oladi
        // WITH_CARRIER → WITH_COURIER_TR
        const { data } = await api.post<{ short_code: string; carrier_name: string | null }>('/scan', {
          qr_payload: qr,
          context: 'COURIER_TR_RECEIVE',
        });
        return {
          short_code: data.short_code,
          info: data.carrier_name ? `✓ Yo'lovchi: ${data.carrier_name}` : '✓ Qabul qilindi',
        };
      } else {
        // COURIER_UZ: Toshkent omboridan oladi
        // AT_TASHKENT_WH → WITH_COURIER_UZ
        const { data } = await api.post<{ short_code: string; spec_title: string }>('/courier/pickup', {
          qr_payload: qr,
        });
        return {
          short_code: data.short_code,
          info: `✓ Yuk olindi: ${data.spec_title}`,
        };
      }
    },
    onSuccess: (data) => {
      haptic('success');
      setScanned((prev) => [{ short_code: data.short_code, ok: true, info: data.info }, ...prev]);
    },
    onError: (error, qr) => {
      haptic('error');
      setScanned((prev) => [
        { short_code: qr.slice(0, 12), ok: false, info: extractErrorMessage(error) },
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

  const ok = scanned.filter((s) => s.ok).length;
  const err = scanned.filter((s) => !s.ok).length;

  // Sarlavha: rol ga qarab
  const title = isTrCourier
    ? '✈️ Yo\'lovchidan qabul'   // COURIER_TR: carrierdan oladi
    : '📦 Ombordan olish';        // COURIER_UZ: ombordan oladi

  return (
    <div className="space-y-3 p-4 pb-20">
      <h2 className="px-1 text-lg font-bold">{title}</h2>

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
          <div className="flex gap-2">
            <span className="rounded bg-green-100 px-2 py-1 text-sm font-bold text-green-700">
              ✓{ok}
            </span>
            {err > 0 && (
              <span className="rounded bg-red-100 px-2 py-1 text-sm font-bold text-red-700">
                ✗{err}
              </span>
            )}
          </div>
        </div>
      </Card>

      {scanned.map((item, idx) => (
        <Card key={idx} className={`py-2 ${!item.ok ? 'border border-red-300' : ''}`}>
          <div className="flex justify-between text-sm">
            <span className="font-mono font-semibold">{item.short_code}</span>
            <span className={item.ok ? 'text-green-500' : 'text-red-500'}>{item.info}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}
