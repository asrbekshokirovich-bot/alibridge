import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api, extractErrorMessage } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { useBackButton, haptic } from '@shared/hooks/useTelegram';

interface OrderLine {
  name: string;
  quantity: number;
  unit_weight_g: number;
  photo_url?: string;
}

interface CreateOrderPayload {
  source: 'SELF' | 'WALK_IN';
  destination_city: string;
  lines: OrderLine[];
  notes?: string;
}

export default function OrderCreate() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [destinationCity, setDestinationCity] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<OrderLine[]>([
    { name: '', quantity: 1, unit_weight_g: 0 },
  ]);

  useBackButton(() => navigate(-1));

  const createMutation = useMutation({
    mutationFn: async (payload: CreateOrderPayload) => {
      const { data } = await api.post<{ id: string; order_number: string }>('/orders', payload);
      return data;
    },
    onSuccess: (data) => {
      haptic('success');
      navigate(`/orderer/orders/${data.id}`);
    },
    onError: (error) => {
      haptic('error');
      alert(extractErrorMessage(error));
    },
  });

  const addLine = () => {
    setLines((prev) => [...prev, { name: '', quantity: 1, unit_weight_g: 0 }]);
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: keyof OrderLine, value: string | number) => {
    setLines((prev) =>
      prev.map((line, i) => (i === idx ? { ...line, [field]: value } : line))
    );
  };

  const handleSubmit = () => {
    if (!destinationCity.trim()) {
      alert(t('orders.destination_required'));
      return;
    }
    const validLines = lines.filter((l) => l.name.trim());
    if (validLines.length === 0) {
      alert(t('orders.lines_required'));
      return;
    }
    createMutation.mutate({
      source: 'SELF',
      destination_city: destinationCity.trim(),
      lines: validLines,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="space-y-4 p-4 pb-24">
      <h2 className="text-lg font-bold">{t('orders.create')}</h2>

      {/* Manzil */}
      <Card>
        <label className="mb-1 block text-sm font-medium">{t('orders.destination')}</label>
        <input
          type="text"
          value={destinationCity}
          onChange={(e) => setDestinationCity(e.target.value)}
          placeholder="Toshkent, Istanbul..."
          className="w-full rounded-lg border border-tg-secondary-bg bg-tg-secondary-bg px-3 py-2 text-sm text-tg-text outline-none focus:border-tg-button"
        />
      </Card>

      {/* Mahsulotlar */}
      <div className="space-y-2">
        <p className="px-1 text-sm font-medium">{t('orders.items')}</p>
        {lines.map((line, idx) => (
          <Card key={idx}>
            <div className="space-y-2">
              <input
                type="text"
                value={line.name}
                onChange={(e) => updateLine(idx, 'name', e.target.value)}
                placeholder={t('orders.item_name')}
                className="w-full rounded-lg border border-tg-secondary-bg bg-tg-secondary-bg px-3 py-2 text-sm text-tg-text outline-none focus:border-tg-button"
              />
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="mb-0.5 block text-xs text-tg-hint">{t('orders.quantity')}</label>
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, 'quantity', parseInt(e.target.value) || 1)}
                    className="w-full rounded-lg border border-tg-secondary-bg bg-tg-secondary-bg px-3 py-1.5 text-sm text-tg-text outline-none focus:border-tg-button"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-0.5 block text-xs text-tg-hint">{t('orders.weight_g')}</label>
                  <input
                    type="number"
                    min={0}
                    value={line.unit_weight_g}
                    onChange={(e) => updateLine(idx, 'unit_weight_g', parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-tg-secondary-bg bg-tg-secondary-bg px-3 py-1.5 text-sm text-tg-text outline-none focus:border-tg-button"
                  />
                </div>
              </div>
              {lines.length > 1 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => removeLine(idx)}
                >
                  {t('common.remove')}
                </Button>
              )}
            </div>
          </Card>
        ))}
        <Button variant="secondary" fullWidth onClick={addLine}>
          + {t('orders.add_item')}
        </Button>
      </div>

      {/* Izoh */}
      <Card>
        <label className="mb-1 block text-sm font-medium">{t('orders.notes')}</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full resize-none rounded-lg border border-tg-secondary-bg bg-tg-secondary-bg px-3 py-2 text-sm text-tg-text outline-none focus:border-tg-button"
        />
      </Card>

      <Button
        fullWidth
        size="lg"
        loading={createMutation.isPending}
        onClick={handleSubmit}
      >
        {t('orders.submit')}
      </Button>
    </div>
  );
}
