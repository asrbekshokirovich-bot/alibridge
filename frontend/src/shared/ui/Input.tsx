interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  icon?: React.ReactNode
}

export function Input({ label, icon, className = '', onWheel, type, inputMode, ...rest }: InputProps) {
  const isNumber = type === 'number'

  // Telegram Desktop WebApp'da <input type="number"> ba'zan klaviatura/fokus olmaydi.
  // Shuning uchun type="text" + inputMode (numeric/decimal) ishlatamiz — raqam
  // klaviaturasi ham chiqadi, desktop bug'i ham chetlab o'tiladi.
  const effectiveType = isNumber ? 'text' : type
  const effectiveInputMode = inputMode ?? (isNumber ? 'decimal' : undefined)

  // Scroll bilan tasodifiy o'zgarishdan himoya (eski type=number xulqi uchun ham qoladi)
  const handleWheel: React.WheelEventHandler<HTMLInputElement> = (e) => {
    if (isNumber) (e.target as HTMLInputElement).blur()
    onWheel?.(e)
  }

  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</label>}
      <div className="relative">
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-dim)' }}>
            {icon}
          </div>
        )}
        <input
          {...rest}
          type={effectiveType}
          inputMode={effectiveInputMode}
          onWheel={handleWheel}
          className={`w-full ${icon ? 'pl-11' : 'pl-4'} pr-4 h-[52px] rounded-2xl text-[15px] focus:ring-2 focus:ring-[rgba(255,92,106,0.25)] focus:outline-none transition-all ${className}`}
          style={{ background: 'var(--card-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
        />
      </div>
    </div>
  )
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export function Textarea({ label, className = '', ...rest }: TextareaProps) {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</label>}
      <textarea
        {...rest}
        className={`w-full px-4 py-3.5 rounded-2xl text-[15px] focus:ring-2 focus:ring-[rgba(255,92,106,0.25)] focus:outline-none transition-all resize-none ${className}`}
        style={{ background: 'var(--card-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
      />
    </div>
  )
}
