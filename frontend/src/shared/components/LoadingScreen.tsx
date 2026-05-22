import { useTranslation } from 'react-i18next';

export function LoadingScreen() {
  const { t } = useTranslation();

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-tg-bg">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-tg-button border-t-transparent" />
      <p className="text-tg-hint">{t('common.loading')}</p>
    </div>
  );
}
