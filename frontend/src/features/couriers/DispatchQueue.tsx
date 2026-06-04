import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, extractErrorMessage } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { EmptyState } from '@shared/components/EmptyState';
import { useBackButton, haptic } from '@shared/hooks/useTelegram';
import { useAuthStore } from '@shared/store/auth';

interface DispatchItem {
  id: string;
  short_code: string;
  spec_title: string;
  photo: string | null;
  unit_weight_g: number;
  notes: string | null;
  picked_up_at: string;
}

export default function CourierDispatchQueue() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isTrCourier = user?.roles.includes('courier_tr') ?? false;

  useBackButton(() => navigate(-1));

  const { data, isLoading, error } = useQuery<DispatchItem[]>({
    queryKey: ['dispatch-queue'],
    queryFn: async () => {
      const { data } = await api.get<DispatchItem[]>('/courier/queue');
      return data;
    },
    refetchInterval: 15_000,
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
        <EmptyState icon="⚠️" title="Xatolik" description={extractErrorMessage(error)} />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          icon="📋"
          title="Navbat bo'sh"
          description="Hozirda qo'lingizdagi mahsulot yo'q"
        />
      </div>
    );
  }

  const totalWeight = data.reduce((s, i) => s + i.unit_weight_g, 0);

  return (
    <div className="space-y-3 p-4 pb-24">
      {/* Sarlavha */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-bold">📦 Qo'limdagi yuklar</h2>
        <div className="flex gap-2">
          <span className="rounded-full bg-accent-blue/15 text-accent-blue text-xs font-bold px-2.5 py-1">
            {data.length} ta
          </span>
          <span className="rounded-full bg-white/5 text-tg-hint text-xs font-semibold px-2.5 py-1">
            {(totalWeight / 1000).toFixed(1)} kg
          </span>
        </div>
      </div>

      {data.map((item) => (
        <Card key={item.id}>
          <div className="flex items-start gap-3">
            {/* Foto */}
            {item.photo ? (
              <img
                src={item.photo}
                alt={item.spec_title}
                className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-tg-secondary-bg flex items-center justify-center flex-shrink-0 text-2xl">
                📦
              </div>
            )}

            {/* Ma'lumot */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight">{item.spec_title}</p>
              <p className="font-mono text-xs text-tg-hint mt-0.5">#{item.short_code}</p>
              <div className="flex gap-2 mt-1">
                <span className="text-xs text-tg-hint">
                  ⚖️ {item.unit_weight_g} g
                </span>
                <span className="text-xs text-tg-hint">
                  🕐 {new Date(item.picked_up_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {item.notes && (
                <p className="text-xs text-tg-hint mt-1">📝 {item.notes}</p>
              )}
            </div>
          </div>

          <Button
            fullWidth
            size="sm"
            loading={deliverMutation.isPending}
            onClick={() => {
              haptic('medium');
              deliverMutation.mutate(item.id);
            }}
          >
            {isTrCourier ? '📥 Omborga topshirish' : '✅ Yetkazildi deb belgilash'}
          </Button>
        </Card>
      ))}
    </div>
  );
}
