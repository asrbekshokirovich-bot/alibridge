import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { useBackButton } from '@shared/hooks/useTelegram';

interface DayReport {
  date: string;
  count: number;
}

export default function DailyReport() {
  const navigate = useNavigate();
  useBackButton(() => navigate(-1));

  const { data, isLoading } = useQuery<DayReport[]>({
    queryKey: ['wh-daily-report'],
    queryFn: async () => {
      const { data } = await api.get<DayReport[]>('/warehouse/uz/daily-report?days=30');
      return data;
    },
  });

  if (isLoading) return <LoadingScreen />;

  const total = (data ?? []).reduce((s, r) => s + r.count, 0);
  const maxCount = Math.max(...(data ?? []).map((r) => r.count), 1);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getDayName = (dateStr: string) => {
    const days = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
    return days[new Date(dateStr).getDay()];
  };

  return (
    <div className="space-y-3 p-4 pb-20">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-bold">📊 Kunlik hisobot</h2>
        <span className="text-sm text-tg-hint">30 kun</span>
      </div>

      {/* Umumiy */}
      <Card>
        <div className="flex justify-between items-center">
          <p className="text-sm text-tg-hint">30 kunda jami chiqim</p>
          <p className="text-2xl font-bold text-tg-button">{total} ta</p>
        </div>
      </Card>

      {!data || data.length === 0 ? (
        <Card>
          <p className="text-center text-sm text-tg-hint">Hali chiqim yo'q</p>
        </Card>
      ) : (
        data.map((row) => (
          <Card key={row.date}>
            <div className="flex items-center gap-3">
              {/* Kun nomi */}
              <div className="w-10 text-center">
                <p className="text-xs font-bold text-tg-button">{getDayName(row.date)}</p>
                <p className="text-xs text-tg-hint">{formatDate(row.date).slice(0, 5)}</p>
              </div>

              {/* Progress bar */}
              <div className="flex-1">
                <div className="h-5 w-full overflow-hidden rounded-full bg-tg-hint/20">
                  <div
                    className="h-full rounded-full bg-tg-button transition-all"
                    style={{ width: `${(row.count / maxCount) * 100}%` }}
                  />
                </div>
              </div>

              {/* Son */}
              <div className="w-12 text-right">
                <p className="font-bold">{row.count}</p>
                <p className="text-xs text-tg-hint">dona</p>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
