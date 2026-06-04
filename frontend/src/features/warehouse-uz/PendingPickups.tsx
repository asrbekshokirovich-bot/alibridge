import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, extractErrorMessage } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { EmptyState } from '@shared/components/EmptyState';
import { useBackButton, haptic } from '@shared/hooks/useTelegram';
import { CarrierDetailModal } from '@features/carrier/CarrierDetailModal';

interface PickItem {
  pick_id: string;
  short_code: string;
  spec_title: string;
  unit_weight_g: number;
  locked_cargo_price: string;
  locked_currency: string;
  picked: boolean;
}

interface CarrierGroup {
  carrier_id: string;
  carrier_name: string;
  telegram_username: string | null;
  items: PickItem[];
  total_weight_g: number;
  all_picked: boolean;
  pending_approval: boolean;
  approved: boolean;
  uz_method: string | null;
  uz_address: string | null;
  tr_method: string | null;
  tr_address: string | null;
}

const UZ_METHOD_LABELS: Record<string, string> = {
  airport_backside: '✈️ Aeroportdan oladi',
  wh_pickup: '🏬 Ombordan oladi',
  free_tashkent: '🏠 Manzilga yetkazish',
  yandex: '🚕 Yandex',
};
const TR_METHOD_LABELS: Record<string, string> = {
  tr_airport_pickup: '✈️ Aeroportda topshiradi',
  tr_courier_from_carrier: '📍 Manzildan kuryer oladi',
  tr_home_hotel_pickup: '🏨 Uy/mehmonxonadan olishadi',
  carrier_dropoff: '🏬 Skladga eltadi',
};

// Yo'lovchi kartasi — RO'YXATDA. Bosilsa mahsulotlar ekraniga kiradi (mahsulotlar tagida ko'rinmaydi).
function CarrierCard({
  group,
  onOpen,
}: {
  group: CarrierGroup;
  onOpen: () => void;
}) {
  const pickedCount = group.items.filter((i) => i.picked).length;
  const total = group.items.length;
  const allDone = group.all_picked;

  return (
    <Card
      onClick={onOpen}
      className={`cursor-pointer active:opacity-80 ${
        allDone ? 'border border-white/10 bg-emerald-500/15' : 'border border-white/10 bg-accent-amber/15'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="truncate font-semibold text-tg-text">{group.carrier_name}</p>
          {group.telegram_username && (
            <p className="text-xs text-tg-hint">@{group.telegram_username}</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-right">
          <div>
            <p className={`text-sm font-bold ${allDone ? 'text-emerald-400' : 'text-accent-amber'}`}>
              {pickedCount}/{total} ta
            </p>
            <p className="text-xs text-tg-hint">{(group.total_weight_g / 1000).toFixed(2)} kg</p>
            {group.pending_approval
              ? <p className="text-xs text-accent-amber font-semibold">⏳ Tasdiq kutilmoqda</p>
              : group.approved && !allDone
              ? <p className="text-xs text-emerald-400 font-semibold">✅ Tasdiqlangan</p>
              : allDone
              ? <p className="text-xs text-emerald-400 font-semibold">✅ Olib ketildi</p>
              : <p className="text-xs text-accent-amber font-semibold">⏳ Kutayapti</p>
            }
          </div>
          <span className="text-tg-hint">›</span>
        </div>
      </div>
    </Card>
  );
}

// Mahsulotlar EKRANI — yo'lovchi bosilganda. Mahsulotlar + yetkazish + tasdiq/rad + ma'lumot.
function PickDetailView({
  group,
  onBack,
  onOpenInfo,
  onApprove,
  onReject,
  busy,
  error,
}: {
  group: CarrierGroup;
  onBack: () => void;
  onOpenInfo: () => void;
  onApprove: (carrierId: string) => void;
  onReject: (carrierId: string, reason: string) => void;
  busy: boolean;
  error: string | null;
}) {
  useBackButton(onBack);
  const pickedCount = group.items.filter((i) => i.picked).length;
  const total = group.items.length;
  const allDone = group.all_picked;
  const [rejecting, setRejecting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <div className="space-y-3 p-4 pb-8">
      {/* Sarlavha — yo'lovchi + ma'lumot tugmasi */}
      <Card className="border border-white/10 bg-tg-sectionBg">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-tg-text">{group.carrier_name}</p>
            {group.telegram_username && (
              <p className="text-xs text-tg-hint">@{group.telegram_username}</p>
            )}
          </div>
          <button
            onClick={() => { haptic('light'); onOpenInfo(); }}
            className="shrink-0 rounded-lg bg-accent-blue/15 px-3 py-1.5 text-xs font-semibold text-accent-blue active:scale-95"
          >
            📋 Ma'lumot
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className={`font-bold ${allDone ? 'text-emerald-400' : 'text-accent-amber'}`}>
            {pickedCount}/{total} ta · {(group.total_weight_g / 1000).toFixed(2)} kg
          </span>
        </div>

        {/* Yetkazib berish usullari */}
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {group.uz_method && (
            <span className="rounded bg-tg-secondary-bg px-2 py-0.5 font-medium text-tg-text ring-1 ring-white/10">
              {UZ_METHOD_LABELS[group.uz_method] ?? group.uz_method}
              {group.uz_address ? `: ${group.uz_address}` : ''}
            </span>
          )}
          {group.tr_method && (
            <span className="rounded bg-tg-secondary-bg px-2 py-0.5 font-medium text-tg-text ring-1 ring-white/10">
              {TR_METHOD_LABELS[group.tr_method] ?? group.tr_method}
              {group.tr_address ? `: ${group.tr_address}` : ''}
            </span>
          )}
        </div>
      </Card>

      {error && (
        <p className="rounded-lg bg-red-500/15 px-3 py-2 text-center text-sm text-red-400">{error}</p>
      )}

      {/* Mahsulotlar ro'yxati */}
      <p className="px-1 text-sm font-semibold text-tg-hint">Mahsulotlar ({total})</p>
      <div className="space-y-1.5">
        {group.items.map((item) => (
          <div
            key={item.pick_id}
            className={`flex items-center justify-between rounded-xl bg-tg-secondary-bg px-3 py-2.5 ${
              item.picked ? 'ring-1 ring-green-400' : ''
            }`}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-tg-text">{item.spec_title}</p>
              <p className="font-mono text-xs text-tg-hint">
                #{item.short_code} · {item.unit_weight_g}g
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <p className="text-xs font-semibold text-tg-button">
                {item.locked_cargo_price} {item.locked_currency}
              </p>
              {item.picked
                ? <span className="text-sm text-green-500">✅</span>
                : <span className="text-sm text-orange-400">⏳</span>
              }
            </div>
          </div>
        ))}
      </div>

      {/* Tasdiqlash / Rad etish — faqat tasdiq kutayotganlar */}
      {group.pending_approval && !rejecting && !confirming && (
        <div className="flex gap-2 pt-1">
          <Button
            fullWidth
            disabled={busy}
            onClick={() => { haptic('light'); setConfirming(true); }}
          >
            ✅ Tasdiqlash
          </Button>
          <button
            onClick={() => { haptic('light'); setRejecting(true); }}
            disabled={busy}
            className="flex-1 rounded-xl bg-red-500/15 py-3 text-sm font-semibold text-red-400 active:scale-95 disabled:opacity-50"
          >
            ❌ Rad etish
          </button>
        </div>
      )}

      {group.pending_approval && confirming && (
        <div className="flex items-center gap-2 pt-1">
          <span className="flex-1 text-sm font-medium text-tg-text">Buyurtma tasdiqlansinmi?</span>
          <button
            onClick={() => { setConfirming(false); haptic('light'); }}
            disabled={busy}
            className="rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold text-tg-hint active:scale-95 disabled:opacity-50"
          >
            Bekor
          </button>
          <Button
            disabled={busy}
            onClick={() => { haptic('medium'); onApprove(group.carrier_id); }}
          >
            {busy ? '⏳' : 'Ha, tasdiqlash'}
          </Button>
        </div>
      )}

      {group.pending_approval && rejecting && (
        <div className="space-y-2 rounded-xl bg-red-500/15 p-3">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Rad etish sababi (ixtiyoriy)"
            className="w-full rounded-lg border border-white/10 bg-tg-sectionBg px-3 py-2 text-sm text-tg-text outline-none placeholder:text-tg-hint"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setRejecting(false); setReason(''); haptic('light'); }}
              disabled={busy}
              className="flex-1 rounded-xl bg-white/5 py-2 text-sm font-semibold text-tg-hint active:scale-95 disabled:opacity-50"
            >
              Bekor
            </button>
            <button
              onClick={() => { haptic('warning'); onReject(group.carrier_id, reason.trim()); }}
              disabled={busy}
              className="flex-1 rounded-xl bg-red-500 py-2 text-sm font-semibold text-white active:scale-95 disabled:opacity-50"
            >
              {busy ? '⏳' : 'Rad etish'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PendingPickups() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);   // passport/ma'lumot modali
  const [openedCarrier, setOpenedCarrier] = useState<string | null>(null);  // ochilgan mahsulotlar ekrani
  const [actionError, setActionError] = useState<string | null>(null);

  useBackButton(() => navigate(-1));

  const { data, isLoading } = useQuery<CarrierGroup[]>({
    queryKey: ['pending-pickups'],
    queryFn: async () => {
      const { data } = await api.get<CarrierGroup[]>('/warehouse/uz/pending-pickups');
      return data;
    },
    refetchInterval: 15_000,
  });

  const approveMutation = useMutation({
    mutationFn: async (carrierId: string) => {
      await api.post(`/warehouse/uz/picks/${carrierId}/approve`);
    },
    onSuccess: () => {
      haptic('success');
      queryClient.invalidateQueries({ queryKey: ['pending-pickups'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-uz-stats'] });
    },
    onError: (e) => { haptic('error'); setActionError(extractErrorMessage(e)); },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ carrierId, reason }: { carrierId: string; reason: string }) => {
      await api.post(`/warehouse/uz/picks/${carrierId}/reject`, { reason: reason || null });
    },
    onSuccess: () => {
      haptic('success');
      queryClient.invalidateQueries({ queryKey: ['pending-pickups'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-uz-stats'] });
    },
    onError: (e) => { haptic('error'); setActionError(extractErrorMessage(e)); },
  });

  const busy = approveMutation.isPending || rejectMutation.isPending;

  if (isLoading) return <LoadingScreen />;

  if (!data || data.length === 0) {
    return (
      <div className="p-4">
        <EmptyState icon="🚶" title="Kutayotgan yo'lovchi yo'q" />
      </div>
    );
  }

  const pending = data.filter((g) => g.pending_approval);
  const waiting = data.filter((g) => !g.pending_approval && !g.all_picked);
  const done = data.filter((g) => !g.pending_approval && g.all_picked);

  // Ochilgan yo'lovchi — mahsulotlar ekrani
  const opened = openedCarrier ? data.find((g) => g.carrier_id === openedCarrier) : null;
  if (opened) {
    return (
      <>
        <PickDetailView
          group={opened}
          busy={busy}
          error={actionError}
          onBack={() => { setOpenedCarrier(null); setActionError(null); }}
          onOpenInfo={() => setSelected(opened.carrier_id)}
          onApprove={(cid) => { setActionError(null); approveMutation.mutate(cid); }}
          onReject={(cid, reason) => { setActionError(null); rejectMutation.mutate({ carrierId: cid, reason }); }}
        />
        {selected && <CarrierDetailModal userId={selected} onClose={() => setSelected(null)} />}
      </>
    );
  }

  const renderGroup = (g: CarrierGroup) => (
    <CarrierCard
      key={g.carrier_id}
      group={g}
      onOpen={() => setOpenedCarrier(g.carrier_id)}
    />
  );

  return (
    <div className="space-y-4 p-4 pb-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">🚶 Yo'lovchilar</h2>
        <div className="flex gap-2">
          {pending.length > 0 && (
            <span className="rounded-full bg-accent-amber/20 px-2 py-0.5 text-xs font-semibold text-accent-amber">
              🆕 {pending.length}
            </span>
          )}
          {waiting.length > 0 && (
            <span className="rounded-full bg-accent-amber/20 px-2 py-0.5 text-xs font-semibold text-accent-amber">
              ⏳ {waiting.length}
            </span>
          )}
          {done.length > 0 && (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-400">
              ✅ {done.length}
            </span>
          )}
        </div>
      </div>

      {actionError && (
        <p className="rounded-lg bg-red-500/15 px-3 py-2 text-center text-sm text-red-400">{actionError}</p>
      )}

      {/* Yangi — tasdiq kutayotganlar */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <p className="px-1 text-sm font-semibold text-accent-amber">🆕 Yangi buyurtmalar (tasdiqlang)</p>
          {pending.map(renderGroup)}
        </div>
      )}

      {/* Tasdiqlangan, olib ketishni kutayotganlar */}
      {waiting.length > 0 && (
        <div className="space-y-3">
          <p className="px-1 text-sm font-semibold text-accent-amber">⏳ Kutayotganlar</p>
          {waiting.map(renderGroup)}
        </div>
      )}

      {/* Olib ketganlar */}
      {done.length > 0 && (
        <div className="space-y-3">
          <p className="px-1 text-sm font-semibold text-emerald-400">✅ Olib ketildi</p>
          {done.map(renderGroup)}
        </div>
      )}

      {selected && <CarrierDetailModal userId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
