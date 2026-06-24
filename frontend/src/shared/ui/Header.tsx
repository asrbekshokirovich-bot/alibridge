import { useNavigate } from 'react-router-dom'
import { useTelegram } from '@/shared/hooks/useTelegram'

interface Props {
  title: string
  subtitle?: string
  showBack?: boolean
  onBack?: () => void
  right?: React.ReactNode
}

/**
 * v2 (redesign): sarlavha biroz kattaroq/qalinroq (kontrast), header foni nozik
 * vertikal gradient + aniqroq pastki chegara. Orqaga tugmasi aniqroq.
 */
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
        background: 'linear-gradient(180deg, rgba(16,28,52,0.92) 0%, rgba(11,20,38,0.72) 100%)',
        borderColor: 'var(--line2)',
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
      }}
    >
      <div className="flex items-center gap-3 px-4 h-14">
        {showBack && (
          <button
            onClick={handleBack}
            className="press w-9 h-9 -ml-1 flex items-center justify-center rounded-full shrink-0 border"
            style={{ background: 'var(--surface2)', borderColor: 'var(--line2)', color: 'var(--muted)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-[18px] font-extrabold tracking-[-0.02em] truncate leading-tight" style={{ color: 'var(--ink)' }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
        {right}
      </div>
    </div>
  )
}
