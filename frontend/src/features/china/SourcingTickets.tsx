import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { extractErrorMessage } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { EmptyState } from '@shared/components/EmptyState';
import { useBackButton, haptic } from '@shared/hooks/useTelegram';
import { useChinaTickets, useSourceTicket, type ChinaTicket } from '@shared/api/queries';

export default function SourcingTickets() {
  const navigate = useNavigate();
  useBackButton(() => navigate(-1));
  const { data: tickets, isLoading } = useChinaTickets();
  const sourceMutation = useSourceTicket();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<'piece' | 'box'>('piece');
  const [count, setCount] = useState('');
  const [weight, setWeight] = useState('');      // dona: gramm/dona; quti: kg/quti
  const [boxItems, setBoxItems] = useState('');  // quti: ichidagi dona soni
  const [error, setError] = useState<string | null>(null);

  const startSourcing = (ticket: ChinaTicket) => {
    setActiveId(ticket.order_line_id);
    setMode('piece');
    setCount(String(ticket.quantity));
    setWeight(ticket.target_unit_weight_g ? String(ticket.target_unit_weight_g) : '');
    setBoxItems('');
    setError(null);
  };

  const submit = (ticket: ChinaTicket) => {
    const c = parseInt(count, 10);
    if (!c || c <= 0) {
      setError('Soni noto\'g\'ri');
      return;
    }
    if (mode === 'piece') {
      const w = parseInt(weight, 10);
      if (!w || w <= 0) {
        setError('Og\'irlik noto\'g\'ri');
        return;
      }
      sourceMutation.mutate(
        { order_line_id: ticket.order_line_id, count: c, unit_weight_g: w },
        {
          onSuccess: () => { haptic('success'); setActiveId(null); },
          onError: (e) => { haptic('error'); setError(extractErrorMessage(e)); },
        },
      );
    } else {
      // Quti rejimi: weight = kg/quti, boxItems = qutidagi dona
      const kg = parseFloat(weight.replace(',', '.'));
      const items = parseInt(boxItems, 10);
      if (!kg || kg <= 0) {
        setError('Quti og\'irligini (kg) kiriting');
        return;
      }
      if (!items || items <= 0) {
        setError('Qutidagi dona sonini kiriting');
        return;
      }
      sourceMutation.mutate(
        {
          order_line_id: ticket.order_line_id,
          count: c,
          unit_weight_g: Math.round(kg * 1000),
          box_items_count: items,
        },
        {
          onSuccess: () => { haptic('success'); setActiveId(null); },
          onError: (e) => { haptic('error'); setError(extractErrorMessage(e)); },
        },
      );
    }
  };

  if (isLoading) {
    return <div className="p-4 text-center text-tg-hint">Yuklanmoqda...</div>;
  }
  if (!tickets || tickets.length === 0) {
    return (
      <EmptyState
        icon="🛒"
        title="Ochiq vazifa yo'q"
        description="Hozircha sotib olinadigan buyurtma yo'q"
      />
    );
  }

  return (
    <div className="space-y-3 p-4 pb-24">
      <h2 className="px-1 text-lg font-bold">🛒 Sourcing vazifalar</h2>
      {tickets.map((ticket) => (
        <Card key={ticket.order_line_id}>
          <div className="flex items-center gap-3">
            {ticket.photos?.[0] && (
              <img src={ticket.photos[0]} alt="" className="h-12 w-12 rounded object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium">{ticket.title}</p>
              <p className="text-xs text-tg-hint">
                {ticket.quantity} dona{ticket.color ? ` · ${ticket.color}` : ''}
              </p>
              {ticket.notes && <p className="text-xs text-tg-hint">{ticket.notes}</p>}
            </div>
          </div>

          {activeId === ticket.order_line_id ? (
            <div className="mt-3 space-y-2">
              {/* Rejim almashtirgich */}
              <div className="flex gap-1 rounded-lg bg-tg-secondary-bg p-1">
                <button
                  type="button"
                  onClick={() => { setMode('piece'); setError(null); }}
                  className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                    mode === 'piece' ? 'bg-tg-button text-white' : 'text-tg-hint'
                  }`}
                >
                  📦 Dona bo'yicha
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('box'); setError(null); }}
                  className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                    mode === 'box' ? 'bg-tg-button text-white' : 'text-tg-hint'
                  }`}
                >
                  🗃️ Quti (kg)
                </button>
              </div>

              {mode === 'piece' ? (
                <div className="flex gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                    placeholder="Soni (dona)"
                    className="w-1/2 rounded-lg border border-tg-hint/30 bg-tg-bg px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="Og'irlik (g/dona)"
                    className="w-1/2 rounded-lg border border-tg-hint/30 bg-tg-bg px-3 py-2 text-sm"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={count}
                      onChange={(e) => setCount(e.target.value)}
                      placeholder="Quti soni"
                      className="w-1/2 rounded-lg border border-tg-hint/30 bg-tg-bg px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="Og'irlik (kg/quti)"
                      className="w-1/2 rounded-lg border border-tg-hint/30 bg-tg-bg px-3 py-2 text-sm"
                    />
                  </div>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={boxItems}
                    onChange={(e) => setBoxItems(e.target.value)}
                    placeholder="Bir qutidagi dona soni"
                    className="w-full rounded-lg border border-tg-hint/30 bg-tg-bg px-3 py-2 text-sm"
                  />
                  <p className="text-[11px] text-tg-hint">
                    Har bir quti alohida sanaladi — ichidagi dona qutiga yozilgan ma'lumotdan olinadi
                  </p>
                </div>
              )}
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-2">
                <Button fullWidth onClick={() => submit(ticket)} loading={sourceMutation.isPending}>
                  ✅ Tasdiqlash
                </Button>
                <Button variant="secondary" onClick={() => setActiveId(null)}>
                  Bekor
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <Button fullWidth onClick={() => startSourcing(ticket)}>
                🛒 Sotib oldim
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
