interface Props extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
  glow?: boolean
}

export function Card({ interactive, glow, className = '', children, ...rest }: Props) {
  return (
    <div
      {...rest}
      className={`rounded-2xl border ${interactive ? 'press cursor-pointer' : ''} ${className}`}
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
        boxShadow: glow ? 'var(--shadow-brand)' : 'var(--shadow-sm)',
        ...(rest.style ?? {}),
      }}
    >
      {children}
    </div>
  )
}
