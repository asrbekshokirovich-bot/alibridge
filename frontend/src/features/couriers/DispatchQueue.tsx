import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api, extractErrorMessage } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { EmptyState } from '@shared/components/EmptyState';
import { useBackButton, haptic } from '@shared/hooks/useTelegram';

interface DispatchItem {
  id: string;
  short_code: string;
  spec_title: string;
  delivery_address: string;
  recipient_name: string;
  recipient_phone: string;
  notes: string | null;
  assigned_at: string;
}

export default function CourierDispatchQueue() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  useBackButton(() => navigate(-1));

  const { data, isLoading, error } = useQuery<DispatchItem[]>({
    queryKey: ['dispatch-queue'],
    queryFn: async () => {
      const { data } = await api.get<DispatchItem[]>('/courier/queue');
      return data;
    },
  });

  const deliverMutation = useMutation({
    mutationFn: async (productId: string) => {
      await api.post(`/courier/deliver/${productId}`);
    },
    onSuccess: () => {
      haptic('success');
      queryClient.invalidateQueries({ queryKey: ['dispatch-queue'] });
      queryClient.invalidateQueries({ queryKey: ['courier-stats'] });
    },
    onError: (error) => {
      haptic('error');
      alert(extractErrorMessage(error));
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
        <EmptyState icon="📋" title={t('courier.queue_empty')} />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 pb-20">
      <h2 className="px-1 text-lg font-bold">
        {t('courier.queue')} ({data.length})
      </h2>

      {data.map((item) => (
        <Card key={item.id}>
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{item.spec_title}</p>
                <p className="font-mono text-xs text-tg-hint">{item.short_code}</p>
              </div>
            </div>

            {/* Yetkazib berish manzili */}
            <div className="rounded bg-tg-secondary-bg p-2 text-sm">
              <p className="font-medium">{item.recipient_name}</p>
              <p className="text-tg-hint">{item.delivery_address}</p>
              <a
                href={`tel:${item.recipient_phone}`}
                className="text-tg-button"
                onClick={(e) => e.stopPropagation()}
              >
                📞 {item.recipient_phone}
              </a>
            </div>

            {item.notes && (
              <p className="text-xs text-tg-hint">📝 {item.notes}</p>
            )}

            <Button
              fullWidth
              size="sm"
              onClick={() => deliverMutation.mutate(item.id)}
            >
              ✅ {t('courier.mark_delivered')}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
