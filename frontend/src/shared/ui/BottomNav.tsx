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
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-30">
      <div className="mx-3 mb-3 bg-white/90 backdrop-blur-xl rounded-3xl border border-slate-100 shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-around px-2 py-2">
          {items.map((item) => {
            const active = location.pathname === item.path
            return (
              <button
                key={item.path}
                onClick={() => { haptic('light'); navigate(item.path) }}
                className="press relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl min-w-[60px]"
              >
                <div
                  className={`flex items-center justify-center transition-colors ${active ? 'text-red-500' : 'text-slate-400'}`}
                  style={active ? { color: 'var(--brand)' } : undefined}
                >
                  {item.icon}
                </div>
                <span className={`text-[10px] font-medium transition-colors ${active ? 'text-red-500' : 'text-slate-400'}`}>
                  {item.label}
                </span>
                {active && (
                  <span
                    className="absolute -bottom-0.5 w-1 h-1 rounded-full"
                    style={{ background: 'var(--brand)' }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
