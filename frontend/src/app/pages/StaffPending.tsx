import { useTranslation } from 'react-i18next'

export default function StaffPending() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-8 text-center animate-scale-in">
      <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6" style={{ background: 'var(--brand-gradient-soft)' }}>
        <div className="text-5xl">⏳</div>
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">{t('So\'rovingiz yuborildi')}</h2>
      <p className="text-sm text-slate-500 max-w-[300px] leading-relaxed">
        {t('Admin sizga rol tayinlagandan keyin tizimga avtomatik kirasiz. Iltimos, kuting.')}
      </p>
      <div className="mt-8 flex items-center gap-2 text-xs text-slate-400">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        {t('Tasdiqlanishi kutilmoqda')}
      </div>
    </div>
  )
}
