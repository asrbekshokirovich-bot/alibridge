interface Props extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
  /** Hero/ko'tarilgan karta — nozik gradient yuza */
  raised?: boolean
  /** Qizil aksent kontur (tanlangan / muhim holat) */
  accent?: boolean
}

export function Card({ interactive, raised, accent, className = '', children, ...rest }: Props) {
  return (
    <div
      {...rest}
      className={`rounded-[18px] border ${interactive ? 'press cursor-pointer' : ''} ${className}`}
      style={{
        background: raised ? 'var(--surface-raised)' : 'var(--card)',
        borderColor: accent ? 'var(--brand-tint-border)' : 'var(--border)',
        boxShadow: raised ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        ...(rest.style ?? {}),
      }}
    >
      {children}
    </div>
  )
}
