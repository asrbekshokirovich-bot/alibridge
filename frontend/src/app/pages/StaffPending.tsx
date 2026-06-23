import { useTranslation } from 'react-i18next'
import { Card } from '@/shared/ui'

export default function StaffPending() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 animate-scale-in" style={{ background: 'var(--bg)' }}>
      <Card className="w-full max-w-sm p-8 text-center">
        <div
          className="w-[64px] h-[64px] mx-auto rounded-[18px] flex items-center justify-center mb-5"
          style={{ background: 'rgba(251,191,36,0.14)', color: '#fbbf24' }}
        >
          {/* Clock / hourglass */}
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </div>
        <h2 className="text-xl font-extrabold mb-2" style={{ color: 'var(--ink)' }}>{t("So'rovingiz yuborildi")}</h2>
        <p className="text-sm max-w-[300px] mx-auto leading-relaxed" style={{ color: 'var(--muted)' }}>
          {t('Admin sizga rol tayinlagandan keyin tizimga avtomatik kirasiz. Iltimos, kuting.')}
        </p>
        <div className="mt-7 inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full"
          style={{ background: 'rgba(251,191,36,0.14)', color: '#fbbf24', border: '1px solid var(--line)' }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--amber)' }} />
          {t('Tasdiqlanishi kutilmoqda')}
        </div>
      </Card>
    </div>
  )
}
