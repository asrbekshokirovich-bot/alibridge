interface Props extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
  glow?: boolean
}

/**
 * v2 (redesign): gradient yuza (--card-gradient) + aniqroq chegara (line2) +
 * chuqurroq soya. glow=true bo'lsa royal halo. interactive bo'lsa ab-card hover.
 */
export function Card({ interactive, glow, className = '', children, ...rest }: Props) {
  return (
    <div
      {...rest}
      className={`rounded-2xl border ${interactive ? 'ab-card cursor-pointer' : ''} ${className}`}
      style={{
        background: interactive ? undefined : 'var(--card-gradient)',
        borderColor: 'var(--line2)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        boxShadow: glow ? 'var(--glow-royal)' : 'var(--shadow-md)',
        ...(rest.style ?? {}),
      }}
    >
      {children}
    </div>
  )
}
