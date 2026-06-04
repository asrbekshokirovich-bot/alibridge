import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@shared/api/client';
import { LanguageSelector } from '@shared/components/LanguageSelector';
import { ActionTile } from '@shared/components/ActionTile';
import { useAuthStore } from '@shared/store/auth';

interface CourierStats {
  pending_pickup: number;
  in_delivery: number;
  delivered_today: number;
}

export default function CourierDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isTrCourier = user?.roles.includes('courier_tr') ?? false;

  const { data: stats, isLoading } = useQuery<CourierStats>({
    queryKey: ['courier-stats'],
    queryFn: async () => {
      const { data } = await api.get<CourierStats>('/courier/stats');
      return data;
    },
    refetchInterval: 30_000,
  });

  const inDelivery = stats?.in_delivery ?? 0;

  return (
    <div className="space-y-5 p-5 pb-8">
      <div className="flex items-center justify-between pt-2 animate-fade-in">
        <div>
          <p className="text-sm text-tg-hint">Salom 👋</p>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {isTrCourier ? 'Turkiya kuryeri' : "O'zbekiston kuryeri"}
          </h1>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-2xl ring-1 ring-white/10">
          {isTrCourier ? '🚚' : '🛵'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 animate-scale-in">
        {[
          { label: "Qo'lida", value: isLoading ? '…' : inDelivery, emoji: '📦', color: 'text-accent-blue' },
          { label: 'Bugun', value: isLoading ? '…' : (stats?.delivered_today ?? 0), emoji: '✅', color: 'text-accent-lime' },
          { label: 'Jami', value: isLoading ? '…' : (inDelivery + (stats?.delivered_today ?? 0)), emoji: '📊', color: 'text-accent-violet' },
        ].map((s) => (
          <div key={s.label} className="rounded-4xl bg-tg-sectionBg p-3 text-center shadow-card ring-1 ring-white/[0.06]">
            <p className="text-xl">{s.emoji}</p>
            <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-tg-hint">{s.label}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="section-title">Amallar</p>
        <div className="grid grid-cols-2 gap-3">
          <ActionTile
            icon="📷"
            label={isTrCourier ? "Yo'lovchidan qabul" : 'Ombordan olish'}
            desc="QR kod bilan qabul"
            color="blue"
            onClick={() => navigate('/couriers/scan')}
          />
          <ActionTile
            icon="📋"
            label="Qo'limdagi yuklar"
            desc="Yetkazish navbati"
            color="violet"
            badge={inDelivery}
            onClick={() => navigate('/couriers/queue')}
          />
          <ActionTile
            icon="✅"
            label="Yetkazilgan yuklar"
            desc={stats?.delivered_today ? `Bugun ${stats.delivered_today} ta` : 'Tarix'}
            color="lime"
            onClick={() => navigate('/couriers/history')}
            className="col-span-2"
          />
        </div>
      </div>

      <LanguageSelector />
    </div>
  );
}
