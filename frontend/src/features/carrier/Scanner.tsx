import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
  const { t } = useTranslation();
  const [entries, setEntries] = useState<ScanEntry[]>([]);
  const [lastQr, setLastQr] = useState<string | null>(null);

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

      {/* Natijalar tarixi */}
      {entries.length > 0 && (
        <div className="space-y-2">
          <p className="px-1 text-sm font-medium text-tg-hint">{t('scan.history')}</p>
          {entries.map((entry, idx) => (
            <Card key={idx} className={entry.error ? 'border border-red-400' : 'border border-green-400'}>
              {entry.result ? (
                <div>
                  <p className="font-mono text-sm font-semibold">{entry.result.short_code}</p>
                  <p className="text-xs text-tg-hint">
                    → {entry.result.new_holder_type}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-red-500">{entry.error}</p>
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
