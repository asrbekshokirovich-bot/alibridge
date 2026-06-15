import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { LangSwitcher } from './LangSwitcher'

// Dashboard yuqori header (gradient + salom)
interface HeaderProps {
  role: string
  name?: string
  gradient?: string
  children?: React.ReactNode // stats va h.k.
}

export function DashboardHeader({ role, name, gradient, children }: HeaderProps) {
  const { t } = useTranslation()
  return (
    <div className="px-5 pt-12 pb-6 text-white" style={{ background: gradient ?? 'var(--brand-gradient)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-white/70">{role}</p>
          <h1 className="text-2xl font-extrabold">
            {name ? <>{t('Salom')}, {name} 👋</> : t('Panel')}
          </h1>
        </div>
        <LangSwitcher />
      </div>
      {children}
    </div>
  )
}

// Bitta amal
export interface Action {
  label: string
  desc: string
  path: string
  icon: React.ReactNode
  gradient: string
  badge?: number
}

// Amallar ro'yxati (kartochkalar)
export function ActionGrid({ actions }: { actions: Action[] }) {
  const navigate = useNavigate()
  const { haptic } = useTelegram()

  return (
    <div className="px-4 pt-5 space-y-3">
      {actions.map((a) => (
        <button key={a.path}
          onClick={() => { haptic('light'); navigate(a.path) }}
          className="press w-full bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm flex items-center gap-3.5 text-left">
          <div className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center text-white shrink-0" style={{ background: a.gradient }}>
            {a.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 text-[15px]">{a.label}</h3>
            <p className="text-xs text-slate-400">{a.desc}</p>
          </div>
          {a.badge ? (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shrink-0">{a.badge}</span>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-slate-300 shrink-0">
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      ))}
    </div>
  )
}
