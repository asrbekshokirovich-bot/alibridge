import { useNavigate, useLocation } from 'react-router-dom'
import { useTelegram } from '@/shared/hooks/useTelegram'

export interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
}

interface Props {
  items: NavItem[]
}

export function BottomNav({ items }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const { haptic } = useTelegram()

  return (
    <div className="tg-only fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-30">
      {/* Pastdan yuqoriga so'nuvchi fon — pill suzayotgandek ko'rinadi */}
      <div className="px-3.5 pb-3.5 pt-2"
        style={{ background: 'linear-gradient(to top, var(--bg) 70%, transparent)' }}>
        <div className="rounded-3xl border"
          style={{ background: 'rgba(20,20,24,0.92)', borderColor: 'var(--border-strong)', backdropFilter: 'blur(24px)', boxShadow: 'var(--shadow-lg)' }}>
          <div className="flex items-center justify-around px-1.5 py-2.5">
            {items.map((item) => {
              const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
              return (
                <button
                  key={item.path}
                  onClick={() => { haptic('light'); navigate(item.path) }}
                  className="press relative flex flex-col items-center gap-1.5 px-3.5 py-1.5 rounded-2xl min-w-[58px] transition-all"
                  style={active ? { background: 'var(--brand-tint)' } : undefined}
                >
                  <div
                    className="flex items-center justify-center transition-all"
                    style={{ color: active ? 'var(--brand)' : 'var(--text-muted)' }}
                  >
                    {item.icon}
                  </div>
                  <span
                    className="text-[10px] transition-all"
                    style={{ color: active ? 'var(--brand)' : 'var(--text-muted)', fontWeight: active ? 700 : 600 }}
                  >
                    {item.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
