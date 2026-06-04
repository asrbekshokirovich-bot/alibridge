import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, extractErrorMessage } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { EmptyState } from '@shared/components/EmptyState';
import { useBackButton } from '@shared/hooks/useTelegram';

interface OrderLine {
  spec_title: string;
  quantity: number;
  notes: string;
}

interface PendingOrder {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  notes: string;
  total_items: number;
  lines: OrderLine[];
}

export default function PendingApprovals() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [approving, setApproving] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useBackButton(() => navigate(-1));

  const { data, isLoading, error } = useQuery<PendingOrder[]>({
    queryKey: ['wh-pending-approvals'],
    queryFn: async () => {
      const { data } = await api.get<PendingOrder[]>('/warehouse/uz/pending-approvals');
      return data;
    },
    refetchInterval: 15000,
  });

  const approveMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await api.post(`/warehouse/uz/orders/${orderId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wh-pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-uz-stats'] });
    },
  });

  const handleApprove = async (orderId: string) => {
    setApproving(orderId);
    try {
      await approveMutation.mutateAsync(orderId);
    } finally {
      setApproving(null);
    }
  };

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
        <EmptyState icon="✅" title="Barcha buyurtmalar tasdiqlangan" description="Hozircha yangi buyurtma yo'q" />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 pb-20">
      <h2 className="px-1 text-lg font-bold">Tasdiqlash kutayotgan buyurtmalar</h2>
      <p className="px-1 text-sm text-tg-hint">{data.length} ta buyurtma</p>

      {data.map((order) => (
        <Card key={order.id}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold">#{order.order_number}</span>
              <span className="text-xs text-tg-hint">
                {new Date(order.created_at).toLocaleDateString()}
              </span>
            </div>

            {order.notes && (
              <p className="text-sm text-tg-hint">📍 {order.notes}</p>
            )}

            <div className="space-y-1">
              {order.lines.map((line, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>{line.spec_title}</span>
                  <span className="font-medium">{line.quantity} dona</span>
                </div>
              ))}
            </div>

            <div className="pt-1">
              {confirmId === order.id ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmId(null)}
                    disabled={approving === order.id}
                    className="flex-1 rounded-xl bg-white/5 py-3 text-sm font-semibold text-tg-hint active:scale-95 disabled:opacity-50"
                  >
                    Bekor
                  </button>
                  <Button
                    className="flex-1"
                    onClick={() => { setConfirmId(null); handleApprove(order.id); }}
                    disabled={approving === order.id}
                  >
                    {approving === order.id ? 'Tasdiqlanmoqda...' : 'Ha, tasdiqlash'}
                  </Button>
                </div>
              ) : (
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={() => setConfirmId(order.id)}
                >
                  ✅ Tasdiqlash
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
