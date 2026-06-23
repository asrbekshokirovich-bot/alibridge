import { useNavigate } from 'react-router-dom'
import { useTelegram } from '@/shared/hooks/useTelegram'

interface Props {
  title: string
  subtitle?: string
  showBack?: boolean
  onBack?: () => void
  right?: React.ReactNode
}

export function Header({ title, subtitle, showBack, onBack, right }: Props) {
  const navigate = useNavigate()
  const { haptic } = useTelegram()

  const handleBack = () => {
    haptic('light')
    if (onBack) onBack()
    else navigate(-1)
  }

  return (
    <div
      className="sticky top-0 z-20 border-b"
      style={{
        background: 'rgba(11,11,14,0.82)',
        borderColor: 'var(--border-soft)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="flex items-center gap-3 px-4 h-14">
        {showBack && (
          <button
            onClick={handleBack}
            className="press w-9 h-9 -ml-1 flex items-center justify-center rounded-full shrink-0 border"
            style={{ background: 'var(--card-2)', borderColor: 'var(--border-chip)', color: 'var(--text-2)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-[19px] font-extrabold tracking-[-0.02em] truncate leading-tight" style={{ color: 'var(--text)' }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
        {right}
      </div>
    </div>
  )
}
