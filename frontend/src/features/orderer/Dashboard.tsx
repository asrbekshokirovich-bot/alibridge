import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@shared/api/client';
import { LanguageSelector } from '@shared/components/LanguageSelector';
import { ActionTile } from '@shared/components/ActionTile';
import { AddRoleCard } from '@features/auth/AddRoleCard';

interface OrderSummary {
  total: number;
  in_transit: number;
  delivered: number;
}

export default function OrdererDashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: summary } = useQuery<OrderSummary>({
    queryKey: ['orderer-summary'],
    queryFn: async () => {
      const { data } = await api.get<OrderSummary>('/orders/summary');
      return data;
    },
  });

  return (
    <div className="space-y-5 p-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between pt-2 animate-fade-in">
        <div>
          <p className="text-sm text-tg-hint">Salom 👋</p>
          <h1 className="text-2xl font-extrabold tracking-tight">{t('roles.orderer')}</h1>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-2xl ring-1 ring-white/10">
          📦
        </span>
      </div>

      {/* Hero stat karta */}
      <div className="relative overflow-hidden rounded-5xl bg-hero-mesh p-6 shadow-glow-violet animate-scale-in">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-accent-blue/30 blur-2xl" />
        <div className="relative">
          <p className="text-sm font-medium text-white/80">{t('orders.total')}</p>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-6xl font-extrabold leading-none text-white">
              {summary?.total ?? 0}
            </span>
            <span className="mb-1.5 text-sm font-semibold text-white/70">ta buyurtma</span>
          </div>
          {/* Statistika chiplari */}
          <div className="mt-5 flex gap-2">
            <div className="flex-1 rounded-2xl bg-white/15 px-3 py-2.5 backdrop-blur">
              <p className="text-xl font-bold text-white">{summary?.in_transit ?? 0}</p>
              <p className="text-[11px] text-white/70">{t('orders.in_transit')}</p>
            </div>
            <div className="flex-1 rounded-2xl bg-white/15 px-3 py-2.5 backdrop-blur">
              <p className="text-xl font-bold text-white">{summary?.delivered ?? 0}</p>
              <p className="text-[11px] text-white/70">{t('orders.delivered')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tezkor amallar */}
      <div>
        <p className="section-title">Tezkor amallar</p>
        <div className="grid grid-cols-2 gap-3">
          <ActionTile
            icon="🛒"
            label="Mening tanlovlarim"
            color="lime"
            onClick={() => navigate('/orderer/my-picks')}
          />
          <ActionTile
            icon="📦"
            label={t('orders.title')}
            color="violet"
            onClick={() => navigate('/orderer/orders')}
          />
        </div>

        {/* Yangi buyurtma — full-width CTA */}
        <button
          onClick={() => navigate('/orderer/orders/new')}
          className="mt-3 flex w-full items-center gap-4 overflow-hidden rounded-4xl bg-gradient-to-br from-accent-pink to-accent-violet p-5 text-left shadow-glow-pink transition-all active:scale-[0.97]"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur">
            ➕
          </span>
          <span className="flex-1 text-lg font-extrabold text-white">{t('orders.create')}</span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-lg font-bold text-white">
            ›
          </span>
        </button>
      </div>

      <AddRoleCard />
      <LanguageSelector />
    </div>
  );
}
