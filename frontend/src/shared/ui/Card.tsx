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
        background: 'var(--surface)',
        borderColor: 'var(--line)',
        boxShadow: glow ? 'var(--shadow-brand)' : 'var(--shadow-md)',
        ...(rest.style ?? {}),
      }}
    >
      {children}
    </div>
  )
}
