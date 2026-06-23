// Gorizontal marshrut progressi — TAS → IST, o'rtada samolyot.
// progress: 0..1 (yo'lning qancha bosib o'tilgani). Samolyot shu nuqtada turadi.

interface Props {
  from?: string
  to?: string
  fromLabel?: string
  toLabel?: string
  /** 0..1 — bosib o'tilgan ulush */
  progress?: number
  className?: string
}

export function RouteProgress({
  from = 'TAS', to = 'IST', fromLabel, toLabel, progress = 0.5, className = '',
}: Props) {
  const pct = Math.max(0, Math.min(1, progress)) * 100
  return (
    <div className={className}>
      <div className="flex items-end justify-between mb-2">
        <div className="text-left">
          <p className="text-[15px] font-extrabold leading-none" style={{ color: 'var(--ink)' }}>{from}</p>
          {fromLabel && <p className="text-[10px] mt-1" style={{ color: 'var(--muted2)' }}>{fromLabel}</p>}
        </div>
        <div className="text-right">
          <p className="text-[15px] font-extrabold leading-none" style={{ color: 'var(--ink)' }}>{to}</p>
          {toLabel && <p className="text-[10px] mt-1" style={{ color: 'var(--muted2)' }}>{toLabel}</p>}
        </div>
      </div>
      {/* yo'l chizig'i */}
      <div className="relative h-5">
        {/* asos chizig'i (nuqtali) */}
        <div className="absolute left-1.5 right-1.5 top-1/2 -translate-y-1/2 h-[2px] rounded"
          style={{ background: 'repeating-linear-gradient(90deg, var(--line2) 0 4px, transparent 4px 9px)' }} />
        {/* bosib o'tilgan qism (lime) */}
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 h-[2px] rounded"
          style={{ width: `calc(${pct}% - 6px)`, background: 'linear-gradient(90deg,#2f5aa0,#D4E94C)' }} />
        {/* boshlanish nuqtasi */}
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
          style={{ background: 'var(--lime)', boxShadow: '0 0 0 4px rgba(212,233,76,0.16)' }} />
        {/* tugash nuqtasi */}
        <span className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
          style={{ background: pct >= 100 ? 'var(--lime)' : 'var(--muted3)', border: '1px solid var(--line2)' }} />
        {/* samolyot */}
        <span className="absolute top-1/2" style={{ left: `${pct}%`, transform: 'translate(-50%,-50%)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#f2f6ff"
            style={{ filter: 'drop-shadow(0 0 6px rgba(212,233,76,0.6))', transform: 'rotate(0deg)' }}>
            <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" transform="rotate(90 12 12)" />
          </svg>
        </span>
      </div>
    </div>
  )
}
