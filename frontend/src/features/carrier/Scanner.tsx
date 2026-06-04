import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, extractErrorMessage } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { useBackButton, haptic } from '@shared/hooks/useTelegram';
import { useScanner } from '@shared/hooks/useScanner';

interface ScanResult {
  product_id: string;
  short_code: string;
  new_holder_type: string;
  event_id: string;
}

interface ScanEntry {
  qr: string;
  result: ScanResult | null;
  error: string | null;
}

export default function CarrierScanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const fromBasket = (location.state as { fromBasket?: boolean } | null)?.fromBasket ?? false;
  const { t } = useTranslation();
  const [entries, setEntries] = useState<ScanEntry[]>([]);
  const [lastQr, setLastQr] = useState<string | null>(null);
  const [scannedCount, setScannedCount] = useState(0);

  useBackButton(() => navigate(-1));

  const scanMutation = useMutation({
    mutationFn: async (qrPayload: string) => {
      const { data } = await api.post<ScanResult>('/scan', {
        qr_payload: qrPayload,
        context: 'CARRIER_RECEIVE',   // WITH_COURIER_UZ → WITH_CARRIER
      });
      return data;
    },
    onSuccess: (data, qrPayload) => {
      haptic('success');
      setEntries((prev) => [{ qr: qrPayload, result: data, error: null }, ...prev]);
      setScannedCount((c) => c + 1);
      queryClient.invalidateQueries({ queryKey: ['carrier-picks'] });
      queryClient.invalidateQueries({ queryKey: ['basket'] });
    },
    onError: (error, qrPayload) => {
      haptic('error');
      setEntries((prev) => [
        { qr: qrPayload, result: null, error: extractErrorMessage(error) },
        ...prev,
      ]);
    },
  });

  const { scannerRef, isScanning, startScan, stopScan } = useScanner({
    onScan: (qr) => {
      // Bir xil QR ni ketma-ket emas, takrorlash oldini olish
      if (qr === lastQr) return;
      setLastQr(qr);
      scanMutation.mutate(qr);
      // 2 soniya keyin navbatdagi skaniga ruxsat
      setTimeout(() => setLastQr(null), 2000);
    },
  });

  return (
    <div className="flex flex-col gap-4 p-4 pb-20">
      {/* Savatchadan kelgan — maxsus ko'rsatma */}
      {fromBasket && (
        <div className="rounded-xl bg-accent-blue/15 border border-white/10 p-3 flex items-start gap-2">
          <span className="text-xl">📦</span>
          <div>
            <p className="text-sm font-semibold text-accent-blue">Mahsulotlarni qabul qiling</p>
            <p className="text-xs text-accent-blue mt-0.5">
              Savatchadagi har bir mahsulotning QR kodini skaner qiling.
              Hammasi skanerlangach pul to'lov tasdiqlanadi.
            </p>
          </div>
        </div>
      )}

      {/* Skaner oynasi */}
      <Card>
        <div ref={scannerRef} className="overflow-hidden rounded-lg" style={{ minHeight: 240 }} />
        <div className="mt-3 flex gap-2">
          {!isScanning ? (
            <Button fullWidth onClick={startScan}>
              📷 {t('scan.start')}
            </Button>
          ) : (
            <Button fullWidth variant="secondary" onClick={stopScan}>
              ⏹ {t('scan.stop')}
            </Button>
          )}
        </div>
      </Card>

      {/* Scan natijalari */}
      {scannedCount > 0 && (
        <Button fullWidth size="lg" onClick={() => navigate('/carrier/picks')}>
          📋 Picklarimga o'tish ({scannedCount} ta qabul qilindi)
        </Button>
      )}

      {entries.length > 0 && (
        <div className="space-y-2">
          <p className="px-1 text-sm font-medium text-tg-hint">Skanerlangan mahsulotlar</p>
          {entries.map((entry, idx) => (
            <Card key={idx} className={entry.error ? 'border border-white/10' : 'border border-white/10'}>
              {entry.result ? (
                <div className="flex items-center gap-2">
                  <span className="text-xl">✅</span>
                  <div>
                    <p className="font-mono text-sm font-semibold">{entry.result.short_code}</p>
                    <p className="text-xs text-emerald-400 font-medium">Qabul qilindi</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xl">❌</span>
                  <p className="text-sm text-red-500">{entry.error}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Bo'sh holat */}
      {entries.length === 0 && !isScanning && (
        <Card>
          <p className="text-center text-sm text-tg-hint">{t('scan.hint')}</p>
        </Card>
      )}
    </div>
  );
}
