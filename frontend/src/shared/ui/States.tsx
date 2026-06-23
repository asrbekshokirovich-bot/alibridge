export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-[18px] p-4 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <Skeleton className="h-4 w-2/3 mb-2" />
          <Skeleton className="h-3 w-1/2 mb-1.5" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  )
}

interface EmptyProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-16 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-[18px] flex items-center justify-center mb-4"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
        {icon ?? (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M21 8l-9-5-9 5m18 0v8l-9 5m9-13l-9 5m0 8l-9-5V8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text)' }}>{title}</h3>
      {description && (
        <p className="text-sm max-w-[260px]" style={{ color: 'var(--text-muted)' }}>{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

interface SuccessProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export function SuccessScreen({ title, description, action }: SuccessProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-8 text-center animate-scale-in">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
        style={{ background: 'rgba(61,220,132,0.14)', border: '1px solid rgba(61,220,132,0.3)' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
          <path d="M20 6L9 17l-5-5" stroke="#3ddc84" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>{title}</h2>
      {description && (
        <p className="text-sm max-w-[280px]" style={{ color: 'var(--text-muted)' }}>{description}</p>
      )}
      {action && <div className="mt-6 w-full max-w-xs">{action}</div>}
    </div>
  )
}
