import { useTelegram } from '@/shared/hooks/useTelegram'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'lime'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  fullWidth?: boolean
  loading?: boolean
}

/**
 * v2 (redesign): primary endi brand gradient + royal glow soya (yassi rangdan
 * ko'ra boyroq). Boshqa variantlar aniqroq chegara/kontrast oldi. Bosilganda
 * .press scale animatsiyasi (GPU-do'st). Ranglar o'zgarmagan.
 */
export function Button({ variant = 'primary', fullWidth, loading, children, className = '', disabled, onClick, ...rest }: Props) {
  const { haptic } = useTelegram()

  const styles: Record<Variant, React.CSSProperties> = {
    primary:   { background: 'var(--brand-gradient)', color: '#fff', boxShadow: 'var(--shadow-brand)' },
    lime:      { background: 'var(--lime)', color: '#0b1426', boxShadow: '0 10px 26px -8px rgba(212,233,76,0.45)' },
    success:   { background: 'linear-gradient(135deg,#34d399,#16A34A)', color: '#fff', boxShadow: '0 12px 26px -8px rgba(22,163,74,0.5)' },
    danger:    { background: 'rgba(255,107,107,0.12)', color: 'var(--red)', border: '1px solid rgba(255,107,107,0.34)' },
    secondary: { background: 'var(--surface2)', color: 'var(--ink)', border: '1px solid var(--line2)' },
    ghost:     { background: 'transparent', color: 'var(--muted)' },
  }

  const spinnerColor = variant === 'lime' ? 'border-black/25 border-t-black' : 'border-white/30 border-t-white'

  return (
    <button
      {...rest}
      disabled={disabled || loading}
      onClick={(e) => { haptic('light'); onClick?.(e) }}
      style={styles[variant]}
      className={`press inline-flex items-center justify-center gap-2 rounded-[13px] px-5 h-[52px] text-[15px] font-bold disabled:opacity-50 disabled:pointer-events-none ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {loading && (
        <span className={`w-4 h-4 border-2 rounded-full animate-spin ${spinnerColor}`} />
      )}
      {children}
    </button>
  )
}
