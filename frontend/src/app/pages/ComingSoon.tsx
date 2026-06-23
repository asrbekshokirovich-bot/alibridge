import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/shared/store/auth'
import { Button } from '@/shared/ui'

interface Props {
  title: string
  subtitle?: string
}

export default function ComingSoon({ title, subtitle }: Props) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const switchRole = () => {
    clearAuth()
    navigate('/welcome', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center animate-scale-in" style={{ background: 'var(--bg)' }}>
      <div
        className="w-[72px] h-[72px] rounded-[20px] flex items-center justify-center mb-6"
        style={{ background: 'rgba(106,163,255,0.14)', border: '1px solid var(--line)', color: '#6aa3ff' }}
      >
        {/* Tools / construction line icon */}
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      </div>
      <h2 className="text-xl font-extrabold mb-2" style={{ color: 'var(--ink)' }}>{title}</h2>
      <p className="text-sm max-w-[280px]" style={{ color: 'var(--muted)' }}>
        {subtitle ?? t("Bu bo'lim tez orada tayyor bo'ladi.")}
      </p>

      {user && (
        <Button variant="secondary" onClick={switchRole} className="mt-8">
          {t('Rolni almashtirish')}
        </Button>
      )}
    </div>
  )
}
