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
  status: string;
  spec_title: string;
}

interface ScannedItem {
  short_code: string;
  status: 'ok' | 'error';
  message: string;
  timestamp: Date;
}

export default function WarehouseUzScanSession() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [scanned, setScanned] = useState<ScannedItem[]>([]);
  const [lastQr, setLastQr] = useState<string | null>(null);

  useBackButton(() => navigate(-1));

  const scanMutation = useMutation({
    mutationFn: async (qrPayload: string) => {
      const { data } = await api.post<ScanResult>('/warehouse/uz/scan', {
        qr_payload: qrPayload,
      });
      return data;
    },
    onSuccess: (data) => {
      haptic('success');
      setScanned((prev) => [
        {
          short_code: data.short_code,
          status: 'ok',
          message: data.spec_title,
          timestamp: new Date(),
        },
        ...prev,
      ]);
    },
    onError: (error, qrPayload) => {
      haptic('error');
      setScanned((prev) => [
        {
          short_code: qrPayload.slice(0, 12) + '...',
          status: 'error',
          message: extractErrorMessage(error),
          timestamp: new Date(),
        },
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

  const okCount = scanned.filter((s) => s.status === 'ok').length;
  const errCount = scanned.filter((s) => s.status === 'error').length;

  return (
    <div className="flex flex-col gap-3 p-4 pb-20">
      {/* Skaner */}
      <Card>
        <div ref={scannerRef} className="overflow-hidden rounded-lg" style={{ minHeight: 220 }} />
        <div className="mt-2 flex gap-2">
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

      {/* Natija hisoblagich */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="text-center">
          <p className="text-2xl font-bold text-green-500">{okCount}</p>
          <p className="text-xs text-tg-hint">{t('scan.ok')}</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-red-500">{errCount}</p>
          <p className="text-xs text-tg-hint">{t('scan.error')}</p>
        </Card>
      </div>

      {/* Skanlar tarixi */}
      {scanned.length > 0 && (
        <div className="space-y-1.5">
          {scanned.slice(0, 20).map((item, idx) => (
            <Card
              key={idx}
              className={`py-2 ${item.status === 'error' ? 'border border-red-300' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">{item.short_code}</span>
                <span className={`text-xs ${item.status === 'ok' ? 'text-green-500' : 'text-red-500'}`}>
                  {item.status === 'ok' ? '✓' : '✗'} {item.message}
                </span>
              </div>
              <p className="text-xs text-tg-hint">{item.timestamp.toLocaleTimeString()}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
