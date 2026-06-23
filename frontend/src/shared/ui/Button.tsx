import { useTelegram } from '@/shared/hooks/useTelegram'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  fullWidth?: boolean
  loading?: boolean
}

export function Button({ variant = 'primary', fullWidth, loading, children, className = '', disabled, onClick, ...rest }: Props) {
  const { haptic } = useTelegram()

  const styles: Record<Variant, React.CSSProperties> = {
    primary: { background: 'var(--brand-gradient)', color: '#fff', boxShadow: 'var(--shadow-brand)' },
    success: { background: 'rgba(61,220,132,0.14)', color: '#3ddc84', border: '1px solid rgba(61,220,132,0.3)' },
    danger:  { background: 'var(--brand-tint)', color: 'var(--brand-light)', border: '1px solid var(--brand-tint-border)' },
    secondary: { background: 'var(--card-2)', color: 'var(--text)', border: '1px solid var(--border-chip)' },
    ghost:   { background: 'transparent', color: 'var(--text-muted)' },
  }

  return (
    <button
      {...rest}
      disabled={disabled || loading}
      onClick={(e) => { haptic('light'); onClick?.(e) }}
      style={styles[variant]}
      className={`press inline-flex items-center justify-center gap-2 rounded-2xl px-5 h-[52px] text-[15px] font-extrabold disabled:opacity-50 disabled:pointer-events-none ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
}
