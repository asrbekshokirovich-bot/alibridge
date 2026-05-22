import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { LanguageSelector } from '@shared/components/LanguageSelector';

interface CourierStats {
  pending_pickup: number;
  in_delivery: number;
  delivered_today: number;
}

export default function CourierDashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: stats } = useQuery<CourierStats>({
    queryKey: ['courier-stats'],
    queryFn: async () => {
      const { data } = await api.get<CourierStats>('/courier/stats');
      return data;
    },
  });

  const items = [
    { icon: '📋', label: t('courier.queue'), path: '/couriers/queue', desc: t('courier.queue_desc') },
    { icon: '📷', label: t('scan.title'), path: '/couriers/scan', desc: t('courier.scan_desc') },
  ];

  return (
    <div className="space-y-3 p-4">
      <h1 className="px-1 text-xl font-bold">{t('roles.courier')}</h1>

      {stats && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t('courier.pending'), value: stats.pending_pickup, emoji: '📦' },
            { label: t('courier.in_delivery'), value: stats.in_delivery, emoji: '🛵' },
            { label: t('courier.today'), value: stats.delivered_today, emoji: '✅' },
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
