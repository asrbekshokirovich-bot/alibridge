import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { EmptyState } from '@shared/components/EmptyState';
import { useBackButton, haptic } from '@shared/hooks/useTelegram';

interface BasketPick {
  id: string;
  product_id: string;
  locked_cargo_price: string;
  locked_currency: string;
  basket_lock_until: string | null;
}

export default function CarrierBasket() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  useBackButton(() => navigate(-1));

  const { data, isLoading } = useQuery<BasketPick[]>({
    queryKey: ['basket'],
    queryFn: async () => {
      const { data } = await api.get<BasketPick[]>('/basket');
      return data;
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (pickId: string) => {
      await api.delete(`/basket/${pickId}`);
    },
    onSuccess: () => {
      haptic('light');
      queryClient.invalidateQueries({ queryKey: ['basket'] });
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
  });

  if (isLoading) return <LoadingScreen />;

  if (!data || data.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          icon="🛒"
          title={t('basket.empty')}
          action={<Button onClick={() => navigate('/carrier/catalog')}>{t('catalog.title')}</Button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 pb-20">
      {data.map((pick) => (
        <Card key={pick.id}>
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium">{pick.product_id.slice(0, 8)}...</p>
              <p className="text-sm font-semibold">
                {pick.locked_cargo_price} {pick.locked_currency}
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => removeMutation.mutate(pick.id)}
            >
              {t('basket.remove')}
            </Button>
          </div>
        </Card>
      ))}

      <Button fullWidth size="lg" onClick={() => alert('Buyurtma berish — keyingi versiya')}>
        {t('basket.checkout')}
      </Button>
    </div>
  );
}
