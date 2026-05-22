import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { api, extractErrorMessage } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { EmptyState } from '@shared/components/EmptyState';
import { useBackButton } from '@shared/hooks/useTelegram';

interface CustodyStep {
  event_type: string;
  holder_type: string;
  created_at: string;
  location?: string;
}

interface ProductTrack {
  short_code: string;
  spec_title: string;
  status: string;
  custody_events: CustodyStep[];
}

interface OrderDetail {
  id: string;
  order_number: string;
  status: string;
  destination_city: string;
  created_at: string;
  lines: Array<{
    id: string;
    spec_title: string;
    quantity: number;
    count_received: number;
  }>;
  products: ProductTrack[];
}

export default function TrackOrder() {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const { t } = useTranslation();

  useBackButton(() => navigate(-1));

  const { data, isLoading, error } = useQuery<OrderDetail>({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const { data } = await api.get<OrderDetail>(`/orders/${orderId}`);
      return data;
    },
    enabled: !!orderId,
  });

  if (isLoading) return <LoadingScreen />;

  if (error || !data) {
    return (
      <div className="p-4">
        <EmptyState icon="⚠️" title={t('common.error')} description={extractErrorMessage(error)} />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 pb-20">
      {/* Buyurtma sarlavhasi */}
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-bold">{data.order_number}</h2>
            <p className="text-sm text-tg-hint">
              {data.destination_city} · {new Date(data.created_at).toLocaleDateString()}
            </p>
          </div>
          <span className="rounded bg-tg-secondary-bg px-2 py-1 text-xs font-medium">
            {data.status}
          </span>
        </div>
      </Card>

      {/* Qatorlar */}
      <div>
        <p className="mb-2 px-1 text-sm font-medium text-tg-hint">{t('orders.items')}</p>
        {data.lines.map((line) => (
          <Card key={line.id} className="mb-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{line.spec_title}</span>
              <span className="text-tg-hint">
                {line.count_received}/{line.quantity}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* Mahsulotlar kuzatuvi */}
      {data.products.length > 0 && (
        <div>
          <p className="mb-2 px-1 text-sm font-medium text-tg-hint">{t('orders.tracking')}</p>
          {data.products.map((product) => (
            <Card key={product.short_code} className="mb-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold">{product.short_code}</span>
                <span className="text-xs font-medium">{product.status}</span>
              </div>

              {/* Custody timeline */}
              <div className="mt-2 space-y-1">
                {product.custody_events.map((event, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs">
                    <div className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-tg-button" />
                    <div>
                      <span className="font-medium">{event.event_type}</span>
                      <span className="ml-1 text-tg-hint">· {event.holder_type}</span>
                      {event.location && (
                        <span className="ml-1 text-tg-hint">· {event.location}</span>
                      )}
                      <p className="text-tg-hint">
                        {new Date(event.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
