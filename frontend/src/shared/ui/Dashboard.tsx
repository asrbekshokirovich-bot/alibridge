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

/**
 * v2 (redesign): hero soyasi chuqurroq, dekoratsiyalar saqlangan (lime wedge,
 * halqa, lime glow, nuqtali reys yoyi). Stat/menyu kartalari endi .ab-card orqali
 * boyroq gradient + glow hover oladi. Ranglar o'zgarmagan.
 */
export function DashboardHeader({ role, name, gradient, children }: HeaderProps) {
  const { t } = useTranslation()
  return (
    <div
      className="relative overflow-hidden px-5 pt-12 pb-10 text-white rounded-b-[28px]"
      style={{
        background:
          gradient ??
          'radial-gradient(130% 80% at 50% -10%, rgba(120,170,255,0.22), transparent 60%), linear-gradient(150deg,#1A3A6C 0%,#16325c 55%,#0F213D 100%)',
        boxShadow: '0 22px 48px -22px rgba(15,33,61,0.85)',
      }}
    >
      {/* Lime burchak (wedge) */}
      <span className="absolute pointer-events-none" style={{
        top: '-46px', right: '-32px', width: '170px', height: '170px',
        background: 'var(--lime)', opacity: 0.13, transform: 'rotate(42deg)', borderRadius: '34px',
      }} />
      {/* Nozik halqa */}
      <span className="absolute pointer-events-none" style={{
        bottom: '-46px', right: '64px', width: '120px', height: '120px',
        border: '1px solid rgba(255,255,255,0.10)', borderRadius: '50%',
      }} />
      {/* Yumshoq lime glow */}
      <span className="absolute pointer-events-none" style={{
        top: '-30px', left: '-20px', width: '180px', height: '140px',
        background: 'radial-gradient(circle at 30% 30%, rgba(212,233,76,0.16), transparent 65%)',
      }} />
      {/* Nozik nuqtali reys yoyi */}
      <svg className="absolute inset-x-0 top-0 w-full pointer-events-none" height="150" viewBox="0 0 400 150"
        preserveAspectRatio="none" style={{ opacity: 0.55 }}>
        <path d="M -12 122 Q 200 18 412 86" fill="none" stroke="rgba(212,233,76,0.30)"
          strokeWidth="1.5" strokeDasharray="1 7" strokeLinecap="round" />
      </svg>

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--lime)' }}>
            {role}
          </p>
          <h1 className="text-[26px] font-extrabold tracking-[-0.02em] mt-1 leading-tight">
            {name ? <>{t('Salom')}, {name}</> : t('Panel')}
          </h1>
        </div>
        <LangSwitcher />
      </div>

      {children && <div className="relative mt-4">{children}</div>}

      {/* Pastki ichki soya — chuqurlik */}
      <span className="absolute inset-x-0 bottom-0 h-12 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(8,18,38,0.28), transparent)' }} />
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

function firstHex(g: string): string {
  const m = g.match(/#[0-9a-fA-F]{6}/)
  return m ? m[0] : '#1A3A6C'
}
function hexToRgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

function ActionCard({ a }: { a: Action }) {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const tint = firstHex(a.gradient)
  return (
    <button
      onClick={() => { haptic('light'); navigate(a.path) }}
      className="ab-card w-full p-4 flex items-center gap-4 text-left cursor-pointer"
    >
      {/* Icon tile — yumshoq tint fon + o'z rangidagi ikona */}
      <div
        className="w-[50px] h-[50px] rounded-[14px] flex items-center justify-center shrink-0"
        style={{ background: hexToRgba(tint, 0.14), color: tint }}
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
          style={{ background: 'var(--royal)', boxShadow: '0 2px 10px -2px rgba(26,58,108,0.8)' }}>
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

export function ActionSections({ sections }: { sections: ActionSection[] }) {
  return (
    <div className="px-4 pt-4 pb-4 space-y-5">
      {sections.filter((s) => s.actions.length > 0).map((section) => (
        <div key={section.title}>
          <p className="flex items-center gap-2 px-1 mb-2.5 text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: 'var(--muted2)' }}>
            <span style={{ width: '14px', height: '2px', borderRadius: '2px', background: 'var(--lime)' }} />
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
