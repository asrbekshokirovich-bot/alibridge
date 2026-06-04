import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@shared/api/client';
import { LanguageSelector } from '@shared/components/LanguageSelector';
import { ActionTile, TileColor } from '@shared/components/ActionTile';

interface TrStats {
  arriving_today: number;
  in_warehouse: number;
  ready_for_pickup: number;
}

export default function WarehouseTrDashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: stats } = useQuery<TrStats>({
    queryKey: ['warehouse-tr-stats'],
    queryFn: async () => {
      const { data } = await api.get<TrStats>('/warehouse/tr/stats');
      return data;
    },
  });

  const items: { icon: string; label: string; path: string; desc: string; color: TileColor }[] = [
    { icon: '✈️', label: t('warehouse_tr.receive'), path: '/warehouse-tr/receive', desc: t('warehouse_tr.receive_desc'), color: 'blue' },
    { icon: '👤', label: t('warehouse_tr.customer_pickup'), path: '/warehouse-tr/handoff', desc: t('warehouse_tr.customer_pickup_desc'), color: 'violet' },
    { icon: '📦', label: 'Mahsulotlar', path: '/warehouse-tr/products', desc: 'Harakati va holati', color: 'lime' },
    { icon: '🧳', label: "Yo'lovchilar", path: '/warehouse-tr/carriers', desc: 'Yuk olib ketayotgan', color: 'cyan' },
    { icon: '💸', label: 'Qarzdorliklar', path: '/warehouse-tr/debts', desc: "Yo'lovchilar qarzi", color: 'pink' },
  ];

  return (
    <div className="space-y-5 p-5 pb-8">
      <div className="flex items-center justify-between pt-2 animate-fade-in">
        <div>
          <p className="text-sm text-tg-hint">Salom 👋</p>
          <h1 className="text-2xl font-extrabold tracking-tight">{t('roles.warehouse_tr')}</h1>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-2xl ring-1 ring-white/10">
          🏬
        </span>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-3 animate-scale-in">
          {[
            { label: t('warehouse_tr.arriving'), value: stats.arriving_today, emoji: '✈️', color: 'text-accent-blue' },
            { label: t('warehouse_tr.in_stock'), value: stats.in_warehouse, emoji: '📦', color: 'text-accent-lime' },
            { label: t('warehouse_tr.ready'), value: stats.ready_for_pickup, emoji: '👤', color: 'text-accent-violet' },
          ].map((s) => (
            <div key={s.label} className="rounded-4xl bg-tg-sectionBg p-3 text-center shadow-card ring-1 ring-white/[0.06]">
              <p className="text-xl">{s.emoji}</p>
              <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-tg-hint">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="section-title">Amallar</p>
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => (
            <ActionTile
              key={item.path}
              icon={item.icon}
              label={item.label}
              desc={item.desc}
              color={item.color}
              onClick={() => navigate(item.path)}
            />
          ))}
        </div>
      </div>

      <LanguageSelector />
    </div>
  );
}
