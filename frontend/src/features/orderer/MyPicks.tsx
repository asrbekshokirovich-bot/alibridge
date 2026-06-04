import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, extractErrorMessage } from '@shared/api/client';
import { Card } from '@shared/components/Card';
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
  wh_uz_approved_at: string | null;
}

export default function MyPicks() {
  const navigate = useNavigate();

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
        <EmptyState icon="⚠️" title="Xatolik" description={extractErrorMessage(error)} />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          icon="🛒"
          title="Hali buyurtma yo'q"
          description="Yangi buyurtma qo'shing"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 pb-20">
      <h2 className="px-1 text-lg font-bold">Mening tanlovlarim</h2>

      {data.map((order) => (
        <Card
          key={order.id}
          className="cursor-pointer active:scale-95"
          onClick={() => navigate(`/orderer/orders/${order.id}`)}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold">#{order.order_number}</span>
              <span className="text-xs text-tg-hint">
                {new Date(order.created_at).toLocaleDateString()}
              </span>
            </div>

            <p className="text-sm text-tg-hint">
              {order.total_items} dona · {order.destination_city || 'Manzil ko\'rsatilmagan'}
            </p>

            {order.wh_uz_approved_at ? (
              <div className="rounded-lg bg-emerald-500/15 p-3 text-sm text-tg-text">
                ✅ Admin buyurtmangizni tasdiqladi. Yetkazib berish kutilmoqda.
              </div>
            ) : (
              <div className="rounded-lg bg-accent-amber/15 p-3 text-sm text-tg-text">
                ⏳ Buyurtma tasdiqlanishini kutmoqda...
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
