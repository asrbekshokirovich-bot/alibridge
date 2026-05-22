import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, extractErrorMessage } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { EmptyState } from '@shared/components/EmptyState';
import { useBackButton, haptic } from '@shared/hooks/useTelegram';
import { useNavigate } from 'react-router-dom';

interface CarrierProfile {
  onboarding_complete: boolean;
}

interface CatalogItem {
  id: string;
  short_code: string;
  spec_title: string;
  spec_photos: string[];
  unit_weight_g: number;
  color: string | null;
  cargo_price: string;
  cargo_currency: string;
}

interface CatalogResponse {
  items: CatalogItem[];
  total: number;
  available_weight_g: number;
}

export default function CarrierCatalog() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [addingId, setAddingId] = useState<string | null>(null);

  useBackButton(() => navigate(-1));

  // ── Onboarding gate ───────────────────────────────────────────────────────
  const { data: carrierProfile, isLoading: profileLoading } = useQuery<CarrierProfile>({
    queryKey: ['carrier-profile'],
    queryFn: async () => {
      const { data } = await api.get<CarrierProfile>('/carrier/profile');
      return data;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!profileLoading && carrierProfile && !carrierProfile.onboarding_complete) {
      navigate('/carrier/onboarding', { replace: true });
    }
  }, [carrierProfile, profileLoading, navigate]);

  if (profileLoading) return <LoadingScreen />;

  // ── Catalog data ──────────────────────────────────────────────────────────
  const { data, isLoading, error } = useQuery<CatalogResponse>({
    queryKey: ['catalog'],
    queryFn: async () => {
      const { data } = await api.get<CatalogResponse>('/catalog');
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async (productId: string) => {
      await api.post('/basket/add', { product_id: productId });
    },
    onMutate: (productId) => setAddingId(productId),
    onSuccess: () => {
      haptic('success');
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
      queryClient.invalidateQueries({ queryKey: ['basket'] });
    },
    onError: (error) => {
      haptic('error');
      alert(extractErrorMessage(error));
    },
    onSettled: () => setAddingId(null),
  });

  if (isLoading) return <LoadingScreen />;

  if (error) {
    return (
      <div className="p-4">
        <EmptyState icon="⚠️" title={t('common.error')} description={extractErrorMessage(error)} />
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="p-4">
        <EmptyState icon="📦" title={t('catalog.no_items')} />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 pb-20">
      <Card>
        <div className="flex justify-between text-sm">
          <span className="text-tg-hint">{t('catalog.weight')}</span>
          <span className="font-semibold">
            {(data.available_weight_g / 1000).toFixed(1)} kg
          </span>
        </div>
      </Card>

      {data.items.map((item) => (
        <Card key={item.id}>
          <div className="flex gap-3">
            {item.spec_photos[0] && (
              <img
                src={item.spec_photos[0]}
                alt={item.spec_title}
                className="h-20 w-20 rounded-lg object-cover"
              />
            )}
            <div className="flex-1">
              <h3 className="font-semibold">{item.spec_title}</h3>
              <p className="text-xs text-tg-hint">
                {item.short_code} · {(item.unit_weight_g / 1000).toFixed(2)} kg
              </p>
              {item.color && <p className="text-xs">Rang: {item.color}</p>}
              <p className="mt-1 text-sm font-medium">
                {item.cargo_price} {item.cargo_currency}
              </p>
            </div>
          </div>
          <Button
            fullWidth
            size="sm"
            className="mt-3"
            loading={addingId === item.id}
            onClick={() => addMutation.mutate(item.id)}
          >
            {t('catalog.add_to_basket')}
          </Button>
        </Card>
      ))}
    </div>
  );
}
