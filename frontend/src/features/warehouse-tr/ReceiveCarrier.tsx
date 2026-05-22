import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api, extractErrorMessage } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { useBackButton, haptic } from '@shared/hooks/useTelegram';
import { useScanner } from '@shared/hooks/useScanner';

interface CarrierArrivalResult {
  carrier_name: string;
  short_code: string;
  new_holder_type: string;
  pick_id: string;
}

interface ReceivedItem {
  short_code: string;
  carrier_name: string;
  ok: boolean;
  message: string;
}

export default function WarehouseTrReceiveCarrier() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [received, setReceived] = useState<ReceivedItem[]>([]);
  const [lastQr, setLastQr] = useState<string | null>(null);

  useBackButton(() => navigate(-1));

  const scanMutation = useMutation({
    mutationFn: async (qr: string) => {
      const { data } = await api.post<CarrierArrivalResult>('/scan', {
        qr_payload: qr,
        context: 'WAREHOUSE_TR_IN',
      });
      return data;
    },
    onSuccess: (data) => {
      haptic('success');
      setReceived((prev) => [
        {
          short_code: data.short_code,
          carrier_name: data.carrier_name,
          ok: true,
          message: `✓ ${data.carrier_name}`,
        },
        ...prev,
      ]);
    },
    onError: (error, qr) => {
      haptic('error');
      setReceived((prev) => [
        {
          short_code: qr.slice(0, 10) + '...',
          carrier_name: '',
          ok: false,
          message: extractErrorMessage(error),
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

  const okCount = received.filter((r) => r.ok).length;

  return (
    <div className="space-y-3 p-4 pb-20">
      <h2 className="px-1 text-lg font-bold">{t('warehouse_tr.receive')}</h2>

      {/* Skaner */}
      <Card>
        <div ref={scannerRef} className="overflow-hidden rounded-lg" style={{ minHeight: 220 }} />
        <div className="mt-2 flex items-center justify-between gap-2">
          {!isScanning ? (
            <Button fullWidth onClick={startScan}>
              📷 {t('scan.start')}
            </Button>
          ) : (
            <Button fullWidth variant="secondary" onClick={stopScan}>
              ⏹ {t('scan.stop')}
            </Button>
          )}
          <span className="flex-shrink-0 rounded-lg bg-tg-secondary-bg px-3 py-2 text-sm font-bold">
            ✓ {okCount}
          </span>
        </div>
      </Card>

      {/* Qabul qilinganlar */}
      {received.map((item, idx) => (
        <Card
          key={idx}
          className={`py-2 ${!item.ok ? 'border border-red-300' : ''}`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-semibold">{item.short_code}</span>
            <span className={`text-xs ${item.ok ? 'text-green-500' : 'text-red-500'}`}>
              {item.message}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}
