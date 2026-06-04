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

interface BasketPick {
  id: string;
  product_id: string;
  short_code: string;
  spec_title: string;
  spec_photo: string | null;
  unit_weight_g: number;
  locked_cargo_price: string;
  locked_currency: string;
  basket_lock_until: string | null;
}

type UzPickup = 'airport' | 'warehouse' | 'address';
type TrHandoff = 'airport' | 'address' | 'hotel';

const UZ_OPTIONS: { key: UzPickup; icon: string; label: string }[] = [
  { key: 'airport', icon: '✈️', label: 'Aeroportdan o\'zim olaman' },
  { key: 'warehouse', icon: '🏬', label: 'Ombordan o\'zim olaman' },
  { key: 'address', icon: '🏠', label: 'Manzilimga yetkazib bering' },
];

const TR_OPTIONS: { key: TrHandoff; icon: string; label: string }[] = [
  { key: 'airport', icon: '✈️', label: 'Aeroportda topshiraman' },
  { key: 'address', icon: '📍', label: 'Manzildan kuryer olib ketsin' },
  { key: 'hotel', icon: '🏨', label: 'Uy yoki mehmonxonadan olib ketishsin' },
];

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

  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [showDelivery, setShowDelivery] = useState(false);
  const [uzPickup, setUzPickup] = useState<UzPickup | null>(null);
  const [uzAddress, setUzAddress] = useState('');
  const [trHandoff, setTrHandoff] = useState<TrHandoff | null>(null);
  const [trAddress, setTrAddress] = useState('');

  // Manzil faqat tegishli tanlovda majburiy
  const uzNeedsAddress = uzPickup === 'address';
  const trNeedsAddress = trHandoff === 'address' || trHandoff === 'hotel';
  const canConfirm =
    !!uzPickup &&
    !!trHandoff &&
    (!uzNeedsAddress || uzAddress.trim().length >= 5) &&
    (!trNeedsAddress || trAddress.trim().length >= 5);

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ confirmed: number }>('/basket/checkout', {
        uz_pickup: uzPickup,
        delivery_address_uz: uzNeedsAddress ? uzAddress.trim() : null,
        tr_handoff: trHandoff,
        carrier_address_tr: trNeedsAddress ? trAddress.trim() : null,
      });
      return data;
    },
    onSuccess: () => {
      haptic('success');
      queryClient.invalidateQueries({ queryKey: ['basket'] });
      queryClient.invalidateQueries({ queryKey: ['catalog-specs'] });
      navigate('/carrier/scan', { state: { fromBasket: true } });
    },
    onError: (e) => {
      haptic('error');
      setCheckoutError(extractErrorMessage(e));
    },
  });

  const submitCheckout = () => {
    if (!canConfirm) return;
    setCheckoutError(null);
    haptic('medium');
    checkoutMutation.mutate();
  };

  const removeMutation = useMutation({
    mutationFn: async (pickId: string) => {
      await api.delete(`/basket/${pickId}`);
    },
    onSuccess: () => {
      haptic('light');
      queryClient.invalidateQueries({ queryKey: ['basket'] });
      queryClient.invalidateQueries({ queryKey: ['catalog-specs'] });
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

  // Spec bo'yicha guruhlash
  const groups = Object.values(
    data.reduce<Record<string, { spec_title: string; spec_photo: string | null; picks: BasketPick[] }>>((acc, pick) => {
      if (!acc[pick.spec_title]) {
        acc[pick.spec_title] = { spec_title: pick.spec_title, spec_photo: pick.spec_photo, picks: [] };
      }
      acc[pick.spec_title]!.picks.push(pick);
      return acc;
    }, {})
  );

  const total = data.reduce((sum, p) => sum + parseFloat(p.locked_cargo_price), 0);
  const currency = data[0]?.locked_currency ?? 'USD';

  return (
    <div className="space-y-3 p-4 pb-28">
      {groups.map((group) => {
        const count = group.picks.length;
        const lastPick = group.picks[group.picks.length - 1]!;
        const totalWeight = group.picks.reduce((s, p) => s + p.unit_weight_g, 0);
        const totalPrice = group.picks.reduce((s, p) => s + parseFloat(p.locked_cargo_price), 0);

        return (
          <Card key={group.spec_title}>
            <div className="flex items-center gap-3">
              {group.spec_photo ? (
                <img src={group.spec_photo} alt={group.spec_title} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 text-2xl">📦</div>
              )}

              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm leading-tight truncate">{group.spec_title}</p>
                <p className="text-xs text-tg-hint mt-0.5">{totalWeight} g</p>
                <p className="text-sm font-semibold text-accent-blue mt-0.5">
                  {totalPrice > 0 ? `${totalPrice.toFixed(2)} ${currency}` : '—'}
                </p>
              </div>

              {/* Soni + o'chirish */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { haptic('medium'); removeMutation.mutate(lastPick.id); }}
                  disabled={removeMutation.isPending}
                  className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 text-xl font-bold flex items-center justify-center active:opacity-70 disabled:opacity-50"
                >−</button>
                <span className="text-sm font-bold w-5 text-center">{count}</span>
                <div className="w-8 h-8" />
              </div>
            </div>
          </Card>
        );
      })}

      {/* Jami + Tasdiqlash */}
      <div className="fixed bottom-0 left-0 right-0 bg-tg-bg/95 backdrop-blur border-t border-white/10 p-4 space-y-2">
        <div className="flex justify-between text-sm text-tg-hint">
          <span>{t('basket.total', 'Jami')}:</span>
          <span className="font-bold text-base text-tg-text">
            {total.toFixed(2)} {currency}
          </span>
        </div>
        <Button
          fullWidth
          size="lg"
          onClick={() => { haptic('medium'); setCheckoutError(null); setShowDelivery(true); }}
        >
          ✅ Tasdiqlash ({data.length} ta mahsulot)
        </Button>
      </div>

      {/* Yetkazib berish / topshirish formasi (bottom sheet) */}
      {showDelivery && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setShowDelivery(false)}>
          <div className="rounded-t-3xl bg-tg-bg p-4 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto h-1 w-10 rounded-full bg-white/10" />
            <h2 className="text-lg font-bold">Yetkazib berish</h2>

            {/* UZ — Toshkentda mahsulotni qanday olish */}
            <div>
              <p className="mb-2 text-sm font-semibold">📍 Toshkentda mahsulotni qanday olasiz?</p>
              <div className="space-y-2">
                {UZ_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => { setUzPickup(opt.key); haptic('light'); }}
                    className={`w-full rounded-xl border p-3 text-sm font-medium text-left ${uzPickup === opt.key ? 'border-tg-button bg-tg-button/10 text-tg-button' : 'border-white/10 text-tg-text'}`}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
              {uzNeedsAddress && (
                <input
                  value={uzAddress}
                  onChange={(e) => setUzAddress(e.target.value)}
                  placeholder="Toshkentdagi to'liq manzilingiz"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-tg-secondaryBg px-3 py-2 text-sm text-tg-text outline-none"
                />
              )}
            </div>

            {/* TR — Turkiyada yukni qanday topshirish */}
            <div>
              <p className="mb-2 text-sm font-semibold">🇹🇷 Turkiyada yukni qanday topshirasiz?</p>
              <div className="space-y-2">
                {TR_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => { setTrHandoff(opt.key); haptic('light'); }}
                    className={`w-full rounded-xl border p-3 text-sm font-medium text-left ${trHandoff === opt.key ? 'border-tg-button bg-tg-button/10 text-tg-button' : 'border-white/10 text-tg-text'}`}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
              {trNeedsAddress && (
                <input
                  value={trAddress}
                  onChange={(e) => setTrAddress(e.target.value)}
                  placeholder={trHandoff === 'hotel' ? 'Mehmonxona/uy manzili (Turkiya)' : 'Turkiyadagi manzilingiz (kuryer keladi)'}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-tg-secondaryBg px-3 py-2 text-sm text-tg-text outline-none"
                />
              )}
            </div>

            {/* Dinamik ko'rsatma — tanlovga qarab */}
            {(uzPickup || trHandoff) && (
              <div className="rounded-xl bg-tg-secondaryBg p-3 space-y-1.5">
                {uzPickup === 'airport' && <p className="text-xs text-tg-text">✈️ Mahsulotlarni Toshkent aeroportidan o'zingiz olasiz.</p>}
                {uzPickup === 'warehouse' && <p className="text-xs text-tg-text">🏬 Mahsulotlarni Toshkentdagi ombordan o'zingiz olasiz.</p>}
                {uzPickup === 'address' && <p className="text-xs text-tg-text">🏠 Mahsulotlar Toshkentdagi manzilingizga yetkazib beriladi.</p>}
                {trHandoff === 'airport' && <p className="text-xs text-tg-text">✈️ Yukni Turkiya aeroportida topshirasiz.</p>}
                {trHandoff === 'address' && <p className="text-xs text-tg-text">📍 Kuryer yukni Turkiyadagi manzilingizdan oladi.</p>}
                {trHandoff === 'hotel' && <p className="text-xs text-tg-text">🏨 Yukni uy yoki mehmonxonangizdan olib ketishadi.</p>}
              </div>
            )}

            {checkoutError && (
              <p className="rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-400 text-center">
                {checkoutError}
              </p>
            )}

            {!canConfirm && (
              <p className="text-center text-xs text-tg-hint">
                {uzNeedsAddress && uzAddress.trim().length < 5
                  ? 'Toshkentdagi manzilni to\'liq kiriting'
                  : trNeedsAddress && trAddress.trim().length < 5
                  ? 'Turkiyadagi manzilni to\'liq kiriting'
                  : 'Davom etish uchun yuqoridagi variantlarni tanlang'}
              </p>
            )}

            <Button
              fullWidth
              size="lg"
              disabled={!canConfirm}
              loading={checkoutMutation.isPending}
              onClick={submitCheckout}
            >
              ✅ Tasdiqlash
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
