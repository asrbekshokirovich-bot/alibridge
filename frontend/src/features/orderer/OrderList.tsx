import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api, extractErrorMessage } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { EmptyState } from '@shared/components/EmptyState';
import { useBackButton } from '@shared/hooks/useTelegram';

interface OrderItem {
  id: string;
  order_number: string;
  status: string;
  total_items: number;
  created_at: string;
  destination_city: string;
}

const STATUS_EMOJI: Record<string, string> = {
  draft: '✏️',
  pending_sourcing: '⏳',
  sourcing: '🏭',
  in_transit_cn_uz: '🚢',
  at_tashkent: '📦',
  in_transit_uz_tr: '✈️',
  at_tr_wh: '🏬',
  partially_delivered: '📬',
  delivered: '🎉',
  cancelled: '❌',
  disputed: '⚠️',
};

export default function OrderList() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  useBackButton(() => navigate(-1));

  const { data, isLoading, error } = useQuery<OrderItem[]>({
    queryKey: ['orders'],
    queryFn: async () => {
      const { data } = await api.get<OrderItem[]>('/orders');
      return data;
    },
  });

  if (isLoading) return <LoadingScreen />;

  if (error) {
    return (
      <div className="p-4">
        <EmptyState icon="⚠️" title={t('common.error')} description={extractErrorMessage(error)} />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          icon="📦"
          title={t('orders.empty')}
          action={
            <Button onClick={() => navigate('/orderer/orders/new')}>{t('orders.create')}</Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 pb-20">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-bold">{t('orders.title')}</h2>
        <Button size="sm" onClick={() => navigate('/orderer/orders/new')}>
          + {t('orders.create')}
        </Button>
      </div>

      {data.map((order) => (
        <Card
          key={order.id}
          className="cursor-pointer active:scale-95"
          onClick={() => navigate(`/orderer/orders/${order.id}`)}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span>{STATUS_EMOJI[order.status] ?? '📋'}</span>
                <span className="font-semibold">{order.order_number}</span>
              </div>
              <p className="mt-0.5 text-sm text-tg-hint">
                {order.total_items} {t('orders.items')} · {order.destination_city}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-tg-hint">
                {new Date(order.created_at).toLocaleDateString()}
              </p>
              <p className="text-xs font-medium">{order.status}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
