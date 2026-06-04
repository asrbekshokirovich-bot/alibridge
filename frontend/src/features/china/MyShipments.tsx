import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { extractErrorMessage } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { EmptyState } from '@shared/components/EmptyState';
import { useBackButton, haptic } from '@shared/hooks/useTelegram';
import { useChinaShipments, useShipProducts } from '@shared/api/queries';

export default function MyShipments() {
  const navigate = useNavigate();
  useBackButton(() => navigate(-1));
  const { data: items, isLoading } = useChinaShipments();
  const shipMutation = useShipProducts();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const ready = (items ?? []).filter((i) => i.status === 'ready_at_china');
  const inTransit = (items ?? []).filter((i) => i.status === 'in_transit_cn_uz');

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const ship = () => {
    if (selected.size === 0) return;
    setError(null);
    shipMutation.mutate(Array.from(selected), {
      onSuccess: () => {
        haptic('success');
        setSelected(new Set());
      },
      onError: (e) => {
        haptic('error');
        setError(extractErrorMessage(e));
      },
    });
  };

  if (isLoading) {
    return <div className="p-4 text-center text-tg-hint">Yuklanmoqda...</div>;
  }
  if (!items || items.length === 0) {
    return (
      <EmptyState icon="📦" title="Jo'natma yo'q" description="Hali mahsulot sotib olinmagan" />
    );
  }

  return (
    <div className="space-y-3 p-4 pb-24">
      <h2 className="px-1 text-lg font-bold">📦 Mening jo'natmalarim</h2>

      {ready.length > 0 && (
        <>
          <p className="px-1 text-xs font-medium text-tg-hint">
            Jo'natishga tayyor ({ready.length})
          </p>
          {ready.map((item) => (
            <Card
              key={item.id}
              className={`cursor-pointer ${selected.has(item.id) ? 'ring-2 ring-tg-button' : ''}`}
              onClick={() => toggle(item.id)}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  readOnly
                  className="h-4 w-4"
                />
                {item.photo && (
                  <img src={item.photo} alt="" className="h-10 w-10 rounded object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.title}</p>
                  <p className="font-mono text-xs text-tg-hint">
                    {item.short_code} · {item.unit_weight_g}g
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </>
      )}

      {inTransit.length > 0 && (
        <>
          <p className="px-1 text-xs font-medium text-tg-hint">Yo'lda ({inTransit.length})</p>
          {inTransit.map((item) => (
            <Card key={item.id} className="opacity-70">
              <div className="flex items-center gap-3">
                <span className="text-lg">🚢</span>
                {item.photo && (
                  <img src={item.photo} alt="" className="h-10 w-10 rounded object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.title}</p>
                  <p className="font-mono text-xs text-tg-hint">
                    {item.short_code} · {item.unit_weight_g}g
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </>
      )}

      {error && <p className="px-1 text-xs text-red-500">{error}</p>}

      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-tg-hint/20 bg-tg-bg p-4">
          <Button fullWidth size="lg" onClick={ship} loading={shipMutation.isPending}>
            🚢 Jo'natish ({selected.size} ta)
          </Button>
        </div>
      )}
    </div>
  );
}
