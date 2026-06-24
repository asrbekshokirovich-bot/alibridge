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

/**
 * v2 (redesign): aktiv tabda lime glow halo + biroz ko'tarilgan ikona,
 * aniqroq chegara (line2) va chuqurroq soya. Rang sxemasi o'zgarmagan.
 */
export function BottomNav({ items }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const { haptic } = useTelegram()

  return (
    <div className="tg-only fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-30">
      <div className="mx-3 mb-3 rounded-3xl border"
        style={{
          background: 'rgba(13,22,42,0.92)',
          borderColor: 'var(--line2)',
          backdropFilter: 'blur(22px) saturate(150%)',
          WebkitBackdropFilter: 'blur(22px) saturate(150%)',
          boxShadow: '0 18px 44px -12px rgba(0,0,0,0.75)',
        }}>
        <div className="flex items-center justify-around px-1 py-2">
          {items.map((item) => {
            const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
            return (
              <button
                key={item.path}
                onClick={() => { haptic('light'); navigate(item.path) }}
                className="press relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-2xl min-w-[60px]"
                style={active
                  ? { background: 'rgba(212,233,76,0.14)', boxShadow: '0 0 18px rgba(212,233,76,0.22)' }
                  : undefined}
              >
                <div
                  className="flex items-center justify-center"
                  style={{
                    color: active ? 'var(--lime)' : 'var(--muted2)',
                    transform: active ? 'translateY(-1px) scale(1.06)' : 'none',
                    transition: 'transform 0.16s cubic-bezier(0.22,0.61,0.36,1), color 0.16s ease',
                  }}
                >
                  {item.icon}
                </div>
                <span
                  className="text-[10px]"
                  style={{
                    color: active ? 'var(--lime)' : 'var(--muted2)',
                    fontWeight: active ? 700 : 600,
                    transition: 'color 0.16s ease',
                  }}
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
