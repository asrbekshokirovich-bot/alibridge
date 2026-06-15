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
    <div className="flex flex-col items-center justify-center min-h-screen px-8 text-center animate-scale-in">
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
        style={{ background: 'var(--brand-gradient-soft)' }}
      >
        <div className="text-5xl">🚧</div>
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">{title}</h2>
      <p className="text-sm text-slate-500 max-w-[280px]">
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
