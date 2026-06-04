import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { EmptyState } from '@shared/components/EmptyState';
import { useBackButton } from '@shared/hooks/useTelegram';

interface HistoryItem {
  product_id: string;
  short_code: string;
  spec_title: string;
  photo: string | null;
  unit_weight_g: number;
  delivered_at: string;
}

function groupByDate(items: HistoryItem[]) {
  const groups: Record<string, HistoryItem[]> = {};
  for (const item of items) {
    const date = new Date(item.delivered_at).toLocaleDateString('uz-UZ', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
    if (!groups[date]) groups[date] = [];
    groups[date].push(item);
  }
  return Object.entries(groups);
}

export default function DeliveryHistory() {
  const navigate = useNavigate();
  useBackButton(() => navigate(-1));

  const { data, isLoading } = useQuery<HistoryItem[]>({
    queryKey: ['courier-history'],
    queryFn: async () => {
      const { data } = await api.get<HistoryItem[]>('/courier/history');
      return data;
    },
  });

  if (isLoading) return <LoadingScreen />;

  if (!data || data.length === 0) {
    return (
      <div className="p-4">
        <EmptyState icon="📦" title="Hali yetkazilgan yuk yo'q" />
      </div>
    );
  }

  const totalWeight = data.reduce((s, i) => s + i.unit_weight_g, 0);
  const groups = groupByDate(data);

  return (
    <div className="space-y-4 p-4 pb-8">
      {/* Sarlavha */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-bold">✅ Yetkazilgan yuklar</h2>
        <div className="flex gap-2">
          <span className="rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2.5 py-1">
            {data.length} ta
          </span>
          <span className="rounded-full bg-white/5 text-tg-hint text-xs font-semibold px-2.5 py-1">
            {(totalWeight / 1000).toFixed(1)} kg
          </span>
        </div>
      </div>

      {groups.map(([date, items]) => (
        <div key={date}>
          <p className="px-1 mb-2 text-xs font-semibold text-tg-hint">{date} — {items.length} ta</p>
          <div className="space-y-2">
            {items.map((item) => (
              <Card key={item.product_id} className="py-2.5">
                <div className="flex items-center gap-3">
                  {item.photo ? (
                    <img
                      src={item.photo}
                      alt={item.spec_title}
                      className="w-11 h-11 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-lg bg-tg-secondary-bg flex items-center justify-center flex-shrink-0 text-xl">
                      📦
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm leading-tight truncate">{item.spec_title}</p>
                    <p className="font-mono text-xs text-tg-hint">#{item.short_code}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-tg-hint">{item.unit_weight_g} g</p>
                    <p className="text-xs text-emerald-400 font-semibold">
                      {new Date(item.delivered_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
