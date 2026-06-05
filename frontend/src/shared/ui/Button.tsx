import { useTelegram } from '@/shared/hooks/useTelegram'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  fullWidth?: boolean
  loading?: boolean
}

const variants: Record<Variant, string> = {
  primary: 'text-white shadow-[var(--shadow-brand)]',
  secondary: 'bg-white text-slate-800 border border-slate-200 shadow-sm',
  danger: 'bg-red-500 text-white shadow-sm',
  ghost: 'bg-slate-100 text-slate-700',
  success: 'text-white shadow-[0_8px_24px_rgba(34,197,94,0.35)]',
}

export function Button({ variant = 'primary', fullWidth, loading, children, className = '', disabled, onClick, ...rest }: Props) {
  const { haptic } = useTelegram()

  const bg =
    variant === 'primary' ? { background: 'var(--brand-gradient)' } :
    variant === 'success' ? { background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' } :
    undefined

  return (
    <button
      {...rest}
      disabled={disabled || loading}
      onClick={(e) => { haptic('light'); onClick?.(e) }}
      style={bg}
      className={`press inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-semibold disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
}
