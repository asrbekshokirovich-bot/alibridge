import { useTranslation } from 'react-i18next';

export function LoadingScreen() {
  const { t } = useTranslation();

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-tg-bg">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-white/10 border-t-accent-violet" />
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-brand-400/30 to-accent-blue/30 blur-md" />
      </div>
      <p className="text-sm text-tg-hint">{t('common.loading')}</p>
    </div>
  );
}
