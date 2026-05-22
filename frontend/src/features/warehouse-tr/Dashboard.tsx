import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { LanguageSelector } from '@shared/components/LanguageSelector';

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

  const items = [
    { icon: '✈️', label: t('warehouse_tr.receive'), path: '/warehouse-tr/receive', desc: t('warehouse_tr.receive_desc') },
    { icon: '👤', label: t('warehouse_tr.customer_pickup'), path: '/warehouse-tr/handoff', desc: t('warehouse_tr.customer_pickup_desc') },
  ];

  return (
    <div className="space-y-3 p-4">
      <h1 className="px-1 text-xl font-bold">{t('roles.warehouse_tr')}</h1>

      {stats && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t('warehouse_tr.arriving'), value: stats.arriving_today, emoji: '✈️' },
            { label: t('warehouse_tr.in_stock'), value: stats.in_warehouse, emoji: '📦' },
            { label: t('warehouse_tr.ready'), value: stats.ready_for_pickup, emoji: '👤' },
          ].map((stat) => (
            <Card key={stat.label} className="text-center">
              <p className="text-xl">{stat.emoji}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-tg-hint">{stat.label}</p>
            </Card>
          ))}
        </div>
      )}

      {items.map((item) => (
        <Card
          key={item.path}
          className="cursor-pointer active:scale-95"
          onClick={() => navigate(item.path)}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{item.icon}</span>
            <div>
              <p className="font-medium">{item.label}</p>
              <p className="text-xs text-tg-hint">{item.desc}</p>
            </div>
          </div>
        </Card>
      ))}

      <LanguageSelector />
    </div>
  );
}
