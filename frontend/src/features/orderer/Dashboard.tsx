import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { LanguageSelector } from '@shared/components/LanguageSelector';

interface OrderSummary {
  total: number;
  in_transit: number;
  delivered: number;
}

export default function OrdererDashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: summary } = useQuery<OrderSummary>({
    queryKey: ['orderer-summary'],
    queryFn: async () => {
      const { data } = await api.get<OrderSummary>('/orders/summary');
      return data;
    },
  });

  const items = [
    { icon: '📦', label: t('orders.title'), path: '/orderer/orders' },
    { icon: '➕', label: t('orders.create'), path: '/orderer/orders/new' },
  ];

  return (
    <div className="space-y-3 p-4">
      <h1 className="px-1 text-xl font-bold">{t('roles.orderer')}</h1>

      {/* Qisqa statistika */}
      {summary && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t('orders.total'), value: summary.total },
            { label: t('orders.in_transit'), value: summary.in_transit },
            { label: t('orders.delivered'), value: summary.delivered },
          ].map((stat) => (
            <Card key={stat.label} className="text-center">
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-tg-hint">{stat.label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Menyu */}
      {items.map((item) => (
        <Card
          key={item.path}
          className="cursor-pointer active:scale-95"
          onClick={() => navigate(item.path)}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </div>
        </Card>
      ))}

      <LanguageSelector />
    </div>
  );
}
