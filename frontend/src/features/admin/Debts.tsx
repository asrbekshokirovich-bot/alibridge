import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { EmptyState } from '@shared/components/EmptyState';
import { useBackButton, haptic } from '@shared/hooks/useTelegram';

interface Debt {
  id: string;
  carrier_name: string;
  product_short_code: string;
  amount: string;
  currency: string;
  reason: string;
  status: string;
  created_at: string;
  settled_at: string | null;
}

type Filter = 'outstanding' | 'settled' | 'all';

/** Yo'lovchilar qarzdorligi — admin (yopa oladi) va ombor xodimi (faqat ko'rish). */
export default function Debts({ readOnly = false }: { readOnly?: boolean }) {
  const navigate = useNavigate();
  useBackButton(() => navigate(-1));
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('outstanding');

  const { data: debts = [], isLoading } = useQuery<Debt[]>({
    queryKey: ['debts', filter],
    queryFn: async () => {
      const { data } = await api.get<Debt[]>(`/admin/debts?status=${filter}`);
      return data;
    },
  });

  const settleMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/admin/debts/${id}/settle`);
    },
    onSuccess: () => {
      haptic('success');
      queryClient.invalidateQueries({ queryKey: ['debts'] });
    },
    onError: () => haptic('error'),
  });

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="space-y-3 p-4 pb-24">
      <h2 className="px-1 text-lg font-bold">💸 Qarzdorliklar</h2>

      <div className="flex gap-1 rounded-lg bg-tg-secondary-bg p-1">
        {(['outstanding', 'settled', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); haptic('light'); }}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
              filter === f ? 'bg-tg-button text-white' : 'text-tg-hint'
            }`}
          >
            {f === 'outstanding' ? "To'lanmagan" : f === 'settled' ? 'Yopilgan' : 'Hammasi'}
          </button>
        ))}
      </div>

      {debts.length === 0 ? (
        <EmptyState icon="✅" title="Qarzdorlik yo'q" />
      ) : (
        debts.map((d) => (
          <Card key={d.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{d.carrier_name}</p>
                <p className="text-xs text-tg-hint">
                  {d.product_short_code} · {new Date(d.created_at).toLocaleDateString('uz-UZ')}
                </p>
                {d.reason && <p className="mt-0.5 text-xs text-tg-hint">{d.reason}</p>}
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="font-bold text-red-400">
                  {+parseFloat(d.amount).toFixed(2)} {d.currency}
                </p>
                <span className={`text-xs ${d.status === 'settled' ? 'text-emerald-400' : 'text-accent-amber'}`}>
                  {d.status === 'settled' ? 'Yopilgan' : "To'lanmagan"}
                </span>
              </div>
            </div>
            {!readOnly && d.status === 'outstanding' && (
              <button
                onClick={() => { haptic('warning'); settleMutation.mutate(d.id); }}
                disabled={settleMutation.isPending}
                className="mt-2 w-full rounded-xl bg-green-500 py-2 text-sm font-semibold text-white active:scale-95 disabled:opacity-50"
              >
                ✓ Yopildi deb belgilash
              </button>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
