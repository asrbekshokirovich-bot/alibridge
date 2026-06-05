// Yuklanish, bo'sh holat va boshqa umumiy holatlar

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100">
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
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4" style={{ background: 'var(--brand-gradient-soft)' }}>
        <div className="text-red-400 text-3xl">{icon ?? '📭'}</div>
      </div>
      <h3 className="text-base font-bold text-slate-800 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 max-w-[260px]">{description}</p>}
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
      <div className="w-24 h-24 rounded-full flex items-center justify-center mb-5" style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', boxShadow: '0 12px 32px rgba(34,197,94,0.4)' }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
          <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">{title}</h2>
      {description && <p className="text-sm text-slate-500 max-w-[280px]">{description}</p>}
      {action && <div className="mt-6 w-full max-w-xs">{action}</div>}
    </div>
  )
}
