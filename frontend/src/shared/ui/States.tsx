export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl p-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
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
    <div className="flex flex-col items-center justify-center px-8 py-14 text-center animate-fade-in">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3.5"
        style={{ background: '#EAEEF4', color: 'var(--muted3)' }}>
        {icon ?? (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.84z" />
            <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
            <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
          </svg>
        )}
      </div>
      <h3 className="text-[14.5px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>{title}</h3>
      {description && (
        <p className="text-[13px] max-w-[260px]" style={{ color: 'var(--muted3)' }}>{description}</p>
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
        style={{ background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.3)' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
          <path d="M20 6L9 17l-5-5" stroke="var(--green)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="text-xl font-extrabold mb-2" style={{ color: 'var(--ink)' }}>{title}</h2>
      {description && (
        <p className="text-sm max-w-[280px]" style={{ color: 'var(--muted)' }}>{description}</p>
      )}
      {action && <div className="mt-6 w-full max-w-xs">{action}</div>}
    </div>
  )
}
