import { useTelegram } from '@/shared/hooks/useTelegram'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'lime'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  fullWidth?: boolean
  loading?: boolean
}

export function Button({ variant = 'primary', fullWidth, loading, children, className = '', disabled, onClick, ...rest }: Props) {
  const { haptic } = useTelegram()

  const styles: Record<Variant, React.CSSProperties> = {
    primary: { background: 'var(--royal)', color: '#fff', boxShadow: 'var(--shadow-brand)' },
    lime:    { background: 'var(--lime)', color: 'var(--ink)', boxShadow: '0 8px 20px rgba(26,58,108,0.18)' },
    success: { background: 'var(--green)', color: '#fff', boxShadow: '0 8px 20px rgba(22,163,74,0.25)' },
    danger:  { background: 'rgba(239,68,68,0.10)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.30)' },
    secondary: { background: 'var(--surface2)', color: 'var(--ink)', border: '1px solid var(--line2)' },
    ghost:   { background: 'transparent', color: 'var(--muted)' },
  }

  // Lime tugma uchun spinner qorong'i bo'lsin
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
