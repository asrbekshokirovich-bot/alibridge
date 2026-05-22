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

interface Pick {
  id: string;
  product_id: string;
  short_code: string;
  spec_title: string;
  locked_cargo_price: string;
  locked_currency: string;
  status: string;
  picked_at: string;
  delivered_at: string | null;
  payout_status: string | null;
}

interface PayoutResponse {
  payout_id: string;
  amount: string;
  currency: string;
  pick_count: number;
}

const PAYOUT_METHODS = [
  { key: 'cash',   label: '💵 Naqd pul' },
  { key: 'bank',   label: '🏦 Bank o\'tkazmasi' },
  { key: 'crypto', label: '₿ Kripto' },
  { key: 'other',  label: '📋 Boshqa' },
] as const;

const STATUS_COLORS: Record<string, string> = {
  IN_TRANSIT: 'text-blue-500',
  DELIVERED:  'text-green-500',
  DISPUTED:   'text-red-500',
  PAID_OUT:   'text-tg-hint',
};

export default function CarrierPicks() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState<'cash' | 'bank' | 'crypto' | 'other'>('bank');
  const [paymentRef, setPaymentRef] = useState('');

  useBackButton(() => {
    if (showPayoutForm) { setShowPayoutForm(false); return; }
    navigate(-1);
  });

  const { data, isLoading, error } = useQuery<Pick[]>({
    queryKey: ['carrier-picks'],
    queryFn: async () => {
      const { data } = await api.get<Pick[]>('/carrier/picks');
      return data;
    },
  });

  const payoutMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<PayoutResponse>('/payouts', {
        method: payoutMethod,
        payment_reference: paymentRef.trim() || null,
        currency: 'USD',
      });
      return data;
    },
    onSuccess: (res) => {
      haptic('success');
      setShowPayoutForm(false);
      setPaymentRef('');
      queryClient.invalidateQueries({ queryKey: ['carrier-picks'] });
      alert(`✅ To'lov so'rovi yuborildi!\n💰 ${res.amount} ${res.currency} (${res.pick_count} ta pick)`);
    },
    onError: (err) => {
      haptic('error');
      alert(extractErrorMessage(err));
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
          icon="📋"
          title={t('picks.empty')}
          action={
            <Button onClick={() => navigate('/carrier/catalog')}>{t('catalog.title')}</Button>
          }
        />
      </div>
    );
  }

  const totalItems = data.length;
  const delivered = data.filter((p) => p.delivered_at).length;
  // Payout so'rash mumkin bo'lgan picklar: yetkazilgan, payout_status yo'q
  const eligibleForPayout = data.filter(
    (p) => p.delivered_at && !p.payout_status
  ).length;

  // ── To'lov so'rash formasi ────────────────────────────────────────────────
  if (showPayoutForm) {
    return (
      <div className="space-y-3 p-4 pb-24">
        <h2 className="px-1 text-lg font-bold">💰 To'lov so'rash</h2>

        <Card>
          <p className="mb-1 text-sm text-tg-hint">
            {eligibleForPayout} ta pick uchun to'lov so'raladi
          </p>
        </Card>

        {/* To'lov usuli */}
        <Card>
          <p className="mb-2 text-sm font-medium">To'lov usuli</p>
          <div className="space-y-2">
            {PAYOUT_METHODS.map((m) => (
              <label key={m.key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="method"
                  value={m.key}
                  checked={payoutMethod === m.key}
                  onChange={() => setPayoutMethod(m.key)}
                  className="accent-tg-button"
                />
                <span>{m.label}</span>
              </label>
            ))}
          </div>
        </Card>

        {/* Hisob raqami (ixtiyoriy) */}
        <Card>
          <label className="mb-1 block text-sm font-medium">
            Hisob / karta / manzil <span className="text-tg-hint">(ixtiyoriy)</span>
          </label>
          <input
            type="text"
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
            placeholder="Karta raqami yoki crypto manzil..."
            className="w-full rounded-lg border border-tg-secondary-bg bg-tg-secondary-bg
                       px-3 py-2 text-sm outline-none focus:border-tg-button"
          />
        </Card>

        <Button
          fullWidth
          size="lg"
          loading={payoutMutation.isPending}
          onClick={() => payoutMutation.mutate()}
        >
          💸 To'lov so'rovini yuborish
        </Button>
      </div>
    );
  }

  // ── Asosiy ro'yxat ────────────────────────────────────────────────────────
  return (
    <div className="space-y-3 p-4 pb-20">
      {/* Statistika */}
      <Card>
        <div className="flex justify-between text-sm">
          <span className="text-tg-hint">{t('picks.total')}</span>
          <span className="font-semibold">{totalItems}</span>
        </div>
        <div className="mt-1 flex justify-between text-sm">
          <span className="text-tg-hint">{t('picks.delivered')}</span>
          <span className="font-semibold text-green-500">{delivered}</span>
        </div>
      </Card>

      {/* To'lov so'rash tugmasi */}
      {eligibleForPayout > 0 && (
        <Button fullWidth size="lg" onClick={() => setShowPayoutForm(true)}>
          💰 To'lov so'rash ({eligibleForPayout} ta pick)
        </Button>
      )}

      {/* Pick ro'yxati */}
      {data.map((pick) => (
        <Card key={pick.id}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="truncate font-semibold">{pick.spec_title}</p>
              <p className="font-mono text-xs text-tg-hint">{pick.short_code}</p>
              <p className="mt-1 text-sm font-medium">
                {pick.locked_cargo_price} {pick.locked_currency}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`text-xs font-semibold ${STATUS_COLORS[pick.status] ?? 'text-tg-hint'}`}>
                {pick.status}
              </span>
              {pick.payout_status && (
                <span className="rounded bg-tg-secondary-bg px-1.5 py-0.5 text-xs text-tg-hint">
                  💰 {pick.payout_status}
                </span>
              )}
            </div>
          </div>
          <p className="mt-2 text-xs text-tg-hint">
            {new Date(pick.picked_at).toLocaleDateString()}
            {pick.delivered_at && (
              <> → {new Date(pick.delivered_at).toLocaleDateString()}</>
            )}
          </p>
        </Card>
      ))}
    </div>
  );
}
