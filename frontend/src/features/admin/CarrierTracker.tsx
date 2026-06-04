import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { EmptyState } from '@shared/components/EmptyState';
import { useBackButton } from '@shared/hooks/useTelegram';
import { CarrierDetailModal } from '@features/carrier/CarrierDetailModal';

const HANDOFF_LABELS: Record<string, { label: string; color: string }> = {
  in_basket:            { label: '🛒 Savatda',           color: 'text-tg-hint bg-white/5' },
  awaiting_handoff:     { label: '⏳ Omborga kelmoqda',  color: 'text-accent-amber bg-accent-amber/15' },
  carrier_has_custody:  { label: '📦 Qabul qildi',       color: 'text-accent-blue bg-accent-blue/15' },
  in_flight:            { label: '✈️ Parvozda',          color: 'text-accent-violet bg-accent-violet/15' },
  dropped_off:          { label: '🏬 Turkiyada',         color: 'text-emerald-400 bg-emerald-500/15' },
};

interface ActiveItem {
  short_code: string;
  spec_title: string;
  unit_weight_g: number;
  status: string;
}

interface CarrierGroup {
  carrier_id: string;
  carrier_name: string;
  telegram_username: string | null;
  items: ActiveItem[];
  total_weight_g: number;
}

interface AllCarrier {
  user_id: string;
  full_name: string;
  phone: string | null;
  telegram_username: string | null;
  depart_iata: string | null;
  arrive_iata: string | null;
  allowed_kg: number | null;
  has_passport: boolean;
}

export default function AdminCarrierTracker() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);

  useBackButton(() => navigate(-1));

  const { data: all = [], isLoading: loadingAll } = useQuery<AllCarrier[]>({
    queryKey: ['admin-all-carriers'],
    queryFn: async () => {
      const { data } = await api.get<AllCarrier[]>('/admin/carriers/all');
      return data;
    },
  });

  const { data: active = [] } = useQuery<CarrierGroup[]>({
    queryKey: ['admin-carriers-active'],
    queryFn: async () => {
      const { data } = await api.get<CarrierGroup[]>('/admin/carriers/active');
      return data;
    },
    refetchInterval: 20_000,
  });

  if (loadingAll) return <LoadingScreen />;

  return (
    <div className="space-y-4 p-4 pb-8">
      {/* ── Barcha ro'yxatdan o'tgan yo'lovchilar ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">👥 Barcha yo'lovchilar</h2>
        <span className="rounded-full bg-accent-blue/15 px-3 py-0.5 text-xs font-semibold text-accent-blue">
          {all.length} ta
        </span>
      </div>

      {all.length === 0 ? (
        <EmptyState icon="👥" title="Hali ro'yxatdan o'tgan yo'lovchi yo'q" />
      ) : (
        <div className="space-y-2">
          {all.map((c) => (
            <Card
              key={c.user_id}
              onClick={() => setSelected(c.user_id)}
              className="cursor-pointer active:opacity-80"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {c.full_name} <span className="text-xs text-tg-button">› ma'lumot</span>
                  </p>
                  <p className="text-xs text-tg-hint">
                    📱 {c.phone || '—'}
                    {c.telegram_username ? ` · @${c.telegram_username}` : ''}
                  </p>
                  <p className="text-xs text-tg-hint">
                    ✈️ {c.depart_iata || '—'}→{c.arrive_iata || '—'}
                    {c.allowed_kg ? ` · ${c.allowed_kg} kg` : ''}
                  </p>
                </div>
                <span className="text-lg">{c.has_passport ? '🪪' : '—'}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Hozir yuk olib ketayotganlar ── */}
      {active.length > 0 && (
        <>
          <h2 className="pt-2 text-lg font-bold">✈️ Hozir yuk bilan</h2>
          {active.map((group) => {
            const statusCounts = group.items.reduce<Record<string, number>>((acc, i) => {
              acc[i.status] = (acc[i.status] || 0) + 1;
              return acc;
            }, {});

            return (
              <div key={group.carrier_id} className="space-y-1.5">
                <Card
                  onClick={() => setSelected(group.carrier_id)}
                  className="cursor-pointer active:opacity-80"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">
                        {group.carrier_name} <span className="text-xs text-tg-button">› ma'lumot</span>
                      </p>
                      {group.telegram_username && (
                        <p className="text-xs text-tg-hint">@{group.telegram_username}</p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Object.entries(statusCounts).map(([s, cnt]) => {
                          const lbl = HANDOFF_LABELS[s];
                          return lbl ? (
                            <span key={s} className={`rounded px-1.5 py-0.5 text-xs font-medium ${lbl.color}`}>
                              {lbl.label} {cnt}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{group.items.length} ta</p>
                      <p className="text-xs text-tg-hint">{(group.total_weight_g / 1000).toFixed(2)} kg</p>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </>
      )}

      {selected && <CarrierDetailModal userId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
