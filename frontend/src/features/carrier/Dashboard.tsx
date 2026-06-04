import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@shared/api/client';
import { LanguageSelector } from '@shared/components/LanguageSelector';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { ActionTile, TileColor } from '@shared/components/ActionTile';
import { AddRoleCard } from '@features/auth/AddRoleCard';

interface CarrierProfile {
  onboarding_complete: boolean;
}

interface BasketPick { id: string }

interface DebtSummary {
  total_by_currency: Record<string, string>;
  count: number;
}

export default function CarrierDashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: profile, isLoading } = useQuery<CarrierProfile>({
    queryKey: ['carrier-profile'],
    queryFn: async () => {
      const { data } = await api.get<CarrierProfile>('/carrier/profile');
      return data;
    },
    staleTime: 60_000,
  });

  const onboardingDone = profile?.onboarding_complete ?? false;

  const { data: basket } = useQuery<BasketPick[]>({
    queryKey: ['basket'],
    queryFn: async () => {
      const { data } = await api.get<BasketPick[]>('/basket');
      return data;
    },
    enabled: onboardingDone,
    staleTime: 30_000,
  });

  const basketCount = basket?.length ?? 0;

  const { data: catalog } = useQuery<{ specs: { available_count: number }[] }>({
    queryKey: ['catalog-specs'],
    queryFn: async () => {
      const { data } = await api.get<{ specs: { available_count: number }[] }>('/catalog/specs');
      return data;
    },
    enabled: onboardingDone,
    staleTime: 15_000,
  });

  const productCount = catalog?.specs.reduce((sum, s) => sum + s.available_count, 0) ?? 0;

  const { data: debts } = useQuery<DebtSummary>({
    queryKey: ['carrier-debts'],
    queryFn: async () => {
      const { data } = await api.get<DebtSummary>('/carrier/debts');
      return data;
    },
    enabled: onboardingDone,
    staleTime: 30_000,
  });

  // Onboarding tugamagan bo'lsa — yo'naltirish (hooks dan keyin)
  if (!isLoading && !onboardingDone) {
    navigate('/carrier/onboarding', { replace: true });
    return null;
  }

  const items: { icon: string; label: string; path: string; color: TileColor; badge?: number | null }[] = [
    { icon: '🛒', label: t('basket.title'),     path: '/carrier/basket',  color: 'lime', badge: basketCount > 0 ? basketCount : null },
    { icon: '📋', label: t('carrier.my_picks'), path: '/carrier/picks',   color: 'blue' },
    { icon: '📷', label: t('carrier.scan'),     path: '/carrier/scan',    color: 'pink' },
  ];

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="space-y-5 p-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between pt-2 animate-fade-in">
        <div>
          <p className="text-sm text-tg-hint">Salom 👋</p>
          <h1 className="text-2xl font-extrabold tracking-tight">{t('roles.carrier')}</h1>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-2xl ring-1 ring-white/10">
          ✈️
        </span>
      </div>

      {/* Hero — savat */}
      <div className="relative overflow-hidden rounded-5xl bg-hero-mesh p-6 shadow-glow-violet animate-scale-in">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-accent-blue/30 blur-2xl" />
        <div className="relative">
          <p className="text-sm font-medium text-white/80">{t('catalog.title')}</p>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-6xl font-extrabold leading-none text-white">{productCount}</span>
            <span className="mb-1.5 text-sm font-semibold text-white/70">ta mavjud</span>
          </div>
          <button
            onClick={() => navigate('/carrier/catalog')}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-bold text-white backdrop-blur transition-all active:scale-95"
          >
            Mahsulotlarni ko'rish ›
          </button>
        </div>
      </div>

      {/* Qarzdorlik ogohlantirishi */}
      {debts && debts.count > 0 && (
        <div className="rounded-4xl bg-gradient-to-br from-red-500/15 to-accent-amber/10 p-4 ring-1 ring-red-500/30">
          <p className="flex items-center gap-2 text-sm font-bold text-red-400">
            ⚠️ Sizda qarzdorlik bor
          </p>
          <p className="mt-1 text-xs text-red-300/90">
            {Object.entries(debts.total_by_currency)
              .map(([cur, amt]) => `${+parseFloat(amt).toFixed(2)} ${cur}`)
              .join(' · ')}{' '}
            ({debts.count} ta yuk)
          </p>
        </div>
      )}

      {/* Amallar bento grid */}
      <div>
        <p className="section-title">Amallar</p>
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => (
            <ActionTile
              key={item.path}
              icon={item.icon}
              label={item.label}
              color={item.color}
              badge={item.badge}
              onClick={() => navigate(item.path)}
            />
          ))}
        </div>
      </div>

      <AddRoleCard />
      <LanguageSelector />
    </div>
  );
}
