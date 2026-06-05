interface Props extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
}

export function Card({ interactive, className = '', children, ...rest }: Props) {
  return (
    <div
      {...rest}
      className={`bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-md)] ${interactive ? 'press cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
