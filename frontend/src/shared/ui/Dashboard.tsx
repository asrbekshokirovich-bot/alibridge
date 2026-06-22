import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { LangSwitcher } from './LangSwitcher'

interface HeaderProps {
  role: string
  name?: string
  gradient?: string
  children?: React.ReactNode
}

export function DashboardHeader({ role, name, gradient, children }: HeaderProps) {
  const { t } = useTranslation()
  return (
    <div
      className="relative overflow-hidden px-5 pt-12 pb-6 text-white"
      style={{ background: gradient ?? 'var(--brand-gradient)' }}
    >
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 80% 60% at 100% 0%, rgba(255,255,255,0.08) 0%, transparent 60%)',
      }} />
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {role}
          </p>
          <h1 className="text-2xl font-extrabold mt-0.5">
            {name ? <>{t('Salom')}, {name} 👋</> : t('Panel')}
          </h1>
        </div>
        <LangSwitcher />
      </div>

      {children && <div className="relative mt-4">{children}</div>}
    </div>
  )
}

export interface Action {
  label: string
  desc: string
  path: string
  icon: React.ReactNode
  gradient: string
  badge?: number
}

export function ActionGrid({ actions }: { actions: Action[] }) {
  const navigate = useNavigate()
  const { haptic } = useTelegram()

  return (
    <div className="px-4 pt-4 pb-4 space-y-2.5">
      {actions.map((a) => (
        <button
          key={a.path}
          onClick={() => { haptic('light'); navigate(a.path) }}
          className="press w-full rounded-2xl p-4 flex items-center gap-4 text-left border transition-all"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          {/* Icon */}
          <div
            className="w-[50px] h-[50px] rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ background: a.gradient }}
          >
            {a.icon}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[15px]" style={{ color: 'var(--text)' }}>
              {a.label}
            </h3>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
              {a.desc}
            </p>
          </div>

          {/* Badge or arrow */}
          {a.badge ? (
            <span className="shrink-0 min-w-[24px] h-6 px-1.5 flex items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: 'var(--brand)' }}>
              {a.badge > 99 ? '99+' : a.badge}
            </span>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0"
              style={{ color: 'var(--border)' }}>
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      ))}
    </div>
  )
}
