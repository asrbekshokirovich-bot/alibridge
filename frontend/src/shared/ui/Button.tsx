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
    success: { background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', color: '#fff', boxShadow: '0 8px 24px rgba(34,197,94,0.35)' },
    danger:  { background: 'rgba(255,71,87,0.15)', color: '#ff6b7a', border: '1px solid rgba(255,71,87,0.3)' },
    secondary: { background: 'var(--card-2)', color: 'var(--text)', border: '1px solid var(--border)' },
    ghost:   { background: 'transparent', color: 'var(--text-muted)' },
  }

  return (
    <button
      {...rest}
      disabled={disabled || loading}
      onClick={(e) => { haptic('light'); onClick?.(e) }}
      style={styles[variant]}
      className={`press inline-flex items-center justify-center gap-2 rounded-2xl px-5 h-[52px] text-[15px] font-bold disabled:opacity-50 disabled:pointer-events-none ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
}
