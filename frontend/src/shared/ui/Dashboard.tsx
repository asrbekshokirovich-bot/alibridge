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
      className="relative overflow-hidden px-5 pt-12 pb-7 text-white"
      style={{ background: gradient ?? 'var(--brand-gradient)' }}
    >
      {/* Lime burchak (wedge) + halqa — reference dekori */}
      <span className="absolute pointer-events-none" style={{
        top: '-44px', right: '-30px', width: '160px', height: '160px',
        background: 'var(--lime)', opacity: 0.15, transform: 'rotate(42deg)', borderRadius: '30px',
      }} />
      <span className="absolute pointer-events-none" style={{
        bottom: '-50px', right: '70px', width: '120px', height: '120px',
        border: '1px solid rgba(255,255,255,0.10)', borderRadius: '50%',
      }} />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--lime)' }}>
            {role}
          </p>
          <h1 className="text-2xl font-extrabold tracking-[-0.02em] mt-1">
            {name ? <>{t('Salom')}, {name}</> : t('Panel')}
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

// Bitta menyu kartasi — ActionGrid va ActionSections uchun umumiy
function ActionCard({ a }: { a: Action }) {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  return (
    <button
      onClick={() => { haptic('light'); navigate(a.path) }}
      className="press w-full rounded-2xl p-4 flex items-center gap-4 text-left border transition-all"
      style={{ background: 'var(--surface)', borderColor: 'var(--line)', boxShadow: 'var(--shadow-md)' }}
    >
      {/* Icon tile */}
      <div
        className="w-[50px] h-[50px] rounded-xl flex items-center justify-center text-white shrink-0"
        style={{ background: a.gradient }}
      >
        {a.icon}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-[15px]" style={{ color: 'var(--ink)' }}>
          {a.label}
        </h3>
        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted)' }}>
          {a.desc}
        </p>
      </div>

      {/* Badge or arrow */}
      {a.badge ? (
        <span className="shrink-0 min-w-[24px] h-6 px-1.5 flex items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ background: 'var(--royal)' }}>
          {a.badge > 99 ? '99+' : a.badge}
        </span>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0"
          style={{ color: 'var(--muted3)' }}>
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

export function ActionGrid({ actions }: { actions: Action[] }) {
  return (
    <div className="px-4 pt-4 pb-4 space-y-2.5">
      {actions.map((a) => <ActionCard key={a.path} a={a} />)}
    </div>
  )
}

export interface ActionSection {
  title: string
  actions: Action[]
}

// Menyu kartalarini sarlavhali bo'limlarga ajratib ko'rsatadi.
// Bo'lim sarlavhasi — kichik, katta harfli "eyebrow" uslubida (muted, harf oralig'i).
export function ActionSections({ sections }: { sections: ActionSection[] }) {
  return (
    <div className="px-4 pt-4 pb-4 space-y-5">
      {sections.filter((s) => s.actions.length > 0).map((section) => (
        <div key={section.title}>
          <p className="px-1 mb-2 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--muted2)' }}>
            {section.title}
          </p>
          <div className="space-y-2.5">
            {section.actions.map((a) => <ActionCard key={a.path} a={a} />)}
          </div>
        </div>
      ))}
    </div>
  )
}
