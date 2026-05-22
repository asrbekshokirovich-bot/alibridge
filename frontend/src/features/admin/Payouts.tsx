import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api, extractErrorMessage } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { EmptyState } from '@shared/components/EmptyState';
import { useBackButton, haptic } from '@shared/hooks/useTelegram';

interface PayoutRequest {
  id: string;
  carrier_name: string;
  carrier_telegram_id: string;
  payout_method: string;
  account_details: string;
  gross_amount: string;
  deductions: string;
  net_amount: string;
  currency: string;
  fx_rate_to_usd: string;
  pick_count: number;
  requested_at: string;
}

export default function AdminPayouts() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // Rad etish formasi: { payoutId, reason }
  const [rejectTarget, setRejectTarget] = useState<{ id: string; reason: string } | null>(null);

  useBackButton(() => {
    if (rejectTarget) { setRejectTarget(null); return; }
    navigate(-1);
  });

  const { data, isLoading } = useQuery<PayoutRequest[]>({
    queryKey: ['admin-payouts'],
    queryFn: async () => {
      const { data } = await api.get<PayoutRequest[]>('/admin/payouts?status=REQUESTED');
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (payoutId: string) => {
      await api.post(`/admin/payouts/${payoutId}/approve`);
    },
    onSuccess: () => {
      haptic('success');
      queryClient.invalidateQueries({ queryKey: ['admin-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (error) => {
      haptic('error');
      alert(extractErrorMessage(error));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await api.post(`/admin/payouts/${id}/reject`, { reason });
    },
    onSuccess: () => {
      haptic('light');
      setRejectTarget(null);
      queryClient.invalidateQueries({ queryKey: ['admin-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (error) => alert(extractErrorMessage(error)),
  });

  if (isLoading) return <LoadingScreen />;

  // ── Rad etish formasi overlay ─────────────────────────────────────────────
  if (rejectTarget) {
    return (
      <div className="space-y-3 p-4 pb-24">
        <h2 className="px-1 text-lg font-bold">❌ {t('admin.reject')}</h2>
        <Card>
          <label className="mb-1 block text-sm font-medium">{t('admin.reject_reason')}</label>
          <textarea
            value={rejectTarget.reason}
            onChange={(e) => setRejectTarget({ ...rejectTarget, reason: e.target.value })}
            rows={4}
            placeholder="Rad etish sababini yozing..."
            className="w-full resize-none rounded-lg border border-tg-secondary-bg
                       bg-tg-secondary-bg px-3 py-2 text-sm text-tg-text outline-none
                       focus:border-tg-button"
          />
        </Card>
        <Button
          fullWidth
          size="lg"
          variant="destructive"
          loading={rejectMutation.isPending}
          onClick={() => {
            if (!rejectTarget.reason.trim()) return;
            rejectMutation.mutate({ id: rejectTarget.id, reason: rejectTarget.reason });
          }}
        >
          ❌ {t('admin.reject')}
        </Button>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-4">
        <EmptyState icon="💰" title={t('admin.no_payouts')} />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 pb-20">
      <h2 className="px-1 text-lg font-bold">
        {t('admin.payouts')} ({data.length})
      </h2>

      {data.map((payout) => (
        <Card key={payout.id}>
          {/* Kuryer info */}
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold">{payout.carrier_name}</p>
              <p className="text-xs text-tg-hint">
                {payout.payout_method} · {payout.pick_count} picks
              </p>
              <p className="text-xs text-tg-hint font-mono">{payout.account_details}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">
                {payout.net_amount} {payout.currency}
              </p>
              <p className="text-xs text-tg-hint">
                1 USD = {payout.fx_rate_to_usd} {payout.currency}
              </p>
            </div>
          </div>

          {/* Hisoblanish */}
          <div className="mt-2 rounded bg-tg-secondary-bg p-2 text-xs">
            <div className="flex justify-between">
              <span className="text-tg-hint">{t('admin.gross')}</span>
              <span>{payout.gross_amount} {payout.currency}</span>
            </div>
            {parseFloat(payout.deductions) > 0 && (
              <div className="flex justify-between text-red-500">
                <span>{t('admin.deductions')}</span>
                <span>-{payout.deductions} {payout.currency}</span>
              </div>
            )}
            <div className="flex justify-between font-bold">
              <span>{t('admin.net')}</span>
              <span>{payout.net_amount} {payout.currency}</span>
            </div>
          </div>

          <p className="mt-1 text-xs text-tg-hint">
            {new Date(payout.requested_at).toLocaleString()}
          </p>

          {/* Tugmalar */}
          <div className="mt-3 flex gap-2">
            <Button
              fullWidth
              size="sm"
              loading={approveMutation.isPending}
              onClick={() => approveMutation.mutate(payout.id)}
            >
              ✅ {t('admin.approve')}
            </Button>
            <Button
              fullWidth
              size="sm"
              variant="destructive"
              onClick={() => setRejectTarget({ id: payout.id, reason: '' })}
            >
              ❌ {t('admin.reject')}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
