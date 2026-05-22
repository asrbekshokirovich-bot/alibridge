import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api, extractErrorMessage } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { useBackButton, haptic } from '@shared/hooks/useTelegram';

interface PendingShipment {
  id: string;
  order_number: string;
  lines: Array<{
    id: string;
    spec_title: string;
    quantity: number;
  }>;
}

interface IntakeResult {
  id: string;
  lines: Array<{
    line_id: string;
    count_received: number;
    discrepancy: 'OK' | 'OVER' | 'SHORT' | 'WRONG';
  }>;
}

export default function WarehouseUzIntake() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [selectedShipment, setSelectedShipment] = useState<PendingShipment | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useBackButton(() => {
    if (selectedShipment) {
      setSelectedShipment(null);
      setCounts({});
    } else {
      navigate(-1);
    }
  });

  const { data: pending, isLoading } = useQuery<PendingShipment[]>({
    queryKey: ['pending-intake'],
    queryFn: async () => {
      const { data } = await api.get<PendingShipment[]>('/warehouse/uz/intake/pending');
      return data;
    },
    enabled: !selectedShipment,
  });

  const intakeMutation = useMutation({
    mutationFn: async (payload: { order_id: string; lines: { line_id: string; count_received: number }[] }) => {
      const { data } = await api.post<IntakeResult>('/warehouse/uz/intake', payload);
      return data;
    },
    onSuccess: (data) => {
      haptic('success');
      const hasDiscrepancy = data.lines.some((l) => l.discrepancy !== 'OK');
      if (hasDiscrepancy) {
        alert(t('warehouse.discrepancy_found'));
      }
      setSelectedShipment(null);
      setCounts({});
    },
    onError: (error) => {
      haptic('error');
      alert(extractErrorMessage(error));
    },
  });

  const handleIntake = () => {
    if (!selectedShipment) return;
    intakeMutation.mutate({
      order_id: selectedShipment.id,
      lines: selectedShipment.lines.map((line) => ({
        line_id: line.id,
        count_received: counts[line.id] ?? line.quantity,
      })),
    });
  };

  if (isLoading && !selectedShipment) return <LoadingScreen />;

  // Qabul jarayoni
  if (selectedShipment) {
    return (
      <div className="space-y-3 p-4 pb-24">
        <Card>
          <h2 className="font-bold">{selectedShipment.order_number}</h2>
          <p className="text-sm text-tg-hint">{t('warehouse.enter_counts')}</p>
        </Card>

        {selectedShipment.lines.map((line) => (
          <Card key={line.id}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <p className="font-medium">{line.spec_title}</p>
                <p className="text-xs text-tg-hint">
                  {t('warehouse.expected')}: {line.quantity}
                </p>
              </div>
              <input
                type="number"
                min={0}
                defaultValue={line.quantity}
                onChange={(e) =>
                  setCounts((prev) => ({ ...prev, [line.id]: parseInt(e.target.value) || 0 }))
                }
                className="w-20 rounded-lg border border-tg-secondary-bg bg-tg-secondary-bg px-2 py-1.5 text-center text-sm text-tg-text outline-none focus:border-tg-button"
              />
            </div>
          </Card>
        ))}

        <Button
          fullWidth
          size="lg"
          loading={intakeMutation.isPending}
          onClick={handleIntake}
        >
          ✅ {t('warehouse.confirm_intake')}
        </Button>
      </div>
    );
  }

  // Kutayotgan jo'natmalar ro'yxati
  return (
    <div className="space-y-3 p-4">
      <h2 className="px-1 text-lg font-bold">{t('warehouse.intake')}</h2>

      {!pending || pending.length === 0 ? (
        <Card>
          <p className="text-center text-sm text-tg-hint">{t('warehouse.no_pending')}</p>
        </Card>
      ) : (
        pending.map((shipment) => (
          <Card
            key={shipment.id}
            className="cursor-pointer active:scale-95"
            onClick={() => {
              setSelectedShipment(shipment);
              const initial: Record<string, number> = {};
              shipment.lines.forEach((l) => (initial[l.id] = l.quantity));
              setCounts(initial);
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{shipment.order_number}</p>
                <p className="text-sm text-tg-hint">
                  {shipment.lines.length} {t('orders.items')}
                </p>
              </div>
              <span className="text-tg-button">→</span>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
