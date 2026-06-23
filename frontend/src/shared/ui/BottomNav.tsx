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
      <div className="mx-3 mb-3 rounded-3xl border"
        style={{ background: 'rgba(255,255,255,0.94)', borderColor: 'var(--line)', backdropFilter: 'blur(20px)', boxShadow: 'var(--shadow-lg)' }}>
        <div className="flex items-center justify-around px-1 py-2">
          {items.map((item) => {
            const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
            return (
              <button
                key={item.path}
                onClick={() => { haptic('light'); navigate(item.path) }}
                className="press relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-2xl min-w-[60px] transition-all"
                style={active ? { background: 'rgba(26,58,108,0.10)' } : undefined}
              >
                <div
                  className="flex items-center justify-center transition-all"
                  style={{ color: active ? 'var(--royal)' : 'var(--muted2)' }}
                >
                  {item.icon}
                </div>
                <span
                  className="text-[10px] transition-all"
                  style={{ color: active ? 'var(--royal)' : 'var(--muted2)', fontWeight: active ? 700 : 600 }}
                >
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
