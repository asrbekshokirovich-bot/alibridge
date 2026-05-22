import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { LanguageSelector } from '@shared/components/LanguageSelector';
import { LoadingScreen } from '@shared/components/LoadingScreen';

interface CarrierProfile {
  onboarding_complete: boolean;
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

  const needsOnboarding = !profile || !profile.onboarding_complete;

  const items = [
    { icon: '📦', label: t('catalog.title'), path: '/carrier/catalog' },
    { icon: '🛒', label: t('basket.title'), path: '/carrier/basket' },
    { icon: '📋', label: t('carrier.my_picks'), path: '/carrier/picks' },
    { icon: '📷', label: t('carrier.scan'),     path: '/carrier/scan' },
  ];

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="space-y-3 p-4">
      <h1 className="px-1 text-xl font-bold">{t('roles.carrier')}</h1>

      {/* Onboarding banner — shown until passport + ticket are uploaded */}
      {needsOnboarding && (
        <Card
          className="cursor-pointer border border-yellow-400 bg-yellow-50 active:scale-95"
          onClick={() => navigate('/carrier/onboarding')}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-semibold text-yellow-800">Ro'yxatdan o'ting</p>
              <p className="text-xs text-yellow-700">
                Katalogdan foydalanish uchun pasport va aviabilet rasmini yuklaing
              </p>
            </div>
            <span className="ml-auto text-yellow-600">→</span>
          </div>
        </Card>
      )}

      {/* Nav items — catalog + basket disabled until onboarding done */}
      {items.map((item) => {
        const locked =
          needsOnboarding &&
          (item.path === '/carrier/catalog' || item.path === '/carrier/basket');

        return (
          <Card
            key={item.path}
            className={`${locked ? 'opacity-50' : 'cursor-pointer active:scale-95'}`}
            onClick={() => {
              if (locked) {
                navigate('/carrier/onboarding');
              } else {
                navigate(item.path);
              }
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
              {locked && (
                <span className="ml-auto text-xs text-tg-hint">🔒 Onboarding kerak</span>
              )}
            </div>
          </Card>
        );
      })}

      <LanguageSelector />
    </div>
  );
}
