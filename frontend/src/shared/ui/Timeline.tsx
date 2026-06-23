// Vertikal kuzatuv tayms-чизиғи (tracking timeline).
// Har bir nuqta: done (yashil check) | active (qizil/coral samolyot, "Hozir") | pending (bo'sh).
// Ixtiyoriy: barkod, reys, qo'shimcha izoh.

export type TimelineState = 'done' | 'active' | 'pending'

export interface TimelineStep {
  title: string
  /** holat matni (masalan sana yoki "Hozir") */
  meta?: string
  state: TimelineState
  /** ixtiyoriy barkod (mono) */
  barcode?: string
  /** ixtiyoriy reys (masalan "Reys HY601 · 26-iyun") */
  flight?: string
  icon?: React.ReactNode
}

const COLORS: Record<TimelineState, { ring: string; bg: string; line: string }> = {
  done:    { ring: '#34d399', bg: 'rgba(52,211,153,0.16)', line: 'rgba(52,211,153,0.5)' },
  active:  { ring: '#ff7a6b', bg: 'rgba(255,122,107,0.16)', line: 'rgba(255,255,255,0.12)' },
  pending: { ring: '#56678a', bg: 'rgba(255,255,255,0.05)', line: 'rgba(255,255,255,0.10)' },
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}
function PlaneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
    </svg>
  )
}

export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="flex flex-col">
      {steps.map((step, i) => {
        const c = COLORS[step.state]
        const last = i === steps.length - 1
        const isActive = step.state === 'active'
        return (
          <div key={i} className="flex gap-3.5">
            {/* marker + chiziq */}
            <div className="flex flex-col items-center">
              <span
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 relative"
                style={{ background: c.bg, border: `1.5px solid ${c.ring}`, color: c.ring }}
              >
                {step.state === 'done' ? <CheckIcon /> : step.state === 'active' ? <PlaneIcon /> : step.icon ?? (
                  <span className="w-2 h-2 rounded-full" style={{ background: c.ring }} />
                )}
                {isActive && (
                  <span className="absolute inset-0 rounded-full" style={{ border: '1.5px solid #ff7a6b', animation: 'tlpulse 1.8s ease-out infinite' }} />
                )}
              </span>
              {!last && <span className="w-[2px] flex-1 my-1 rounded" style={{ background: c.line, minHeight: 26 }} />}
            </div>

            {/* kontent */}
            <div className={`flex-1 min-w-0 ${last ? 'pb-0' : 'pb-5'}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[14px] font-bold" style={{ color: step.state === 'pending' ? 'var(--muted)' : 'var(--ink)' }}>
                  {step.title}
                </p>
                {isActive && step.meta && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ color: '#0a1020', background: '#ff7a6b' }}>{step.meta}</span>
                )}
              </div>
              {step.meta && !isActive && (
                <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--muted2)' }}>{step.meta}</p>
              )}
              {step.flight && (
                <p className="text-[11.5px] mt-1.5" style={{ color: 'var(--muted)' }}>{step.flight}</p>
              )}
              {step.barcode && (
                <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-lg"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--line)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14M21 5v14" />
                  </svg>
                  <span className="text-[11px] font-mono" style={{ color: 'var(--muted)' }}>{step.barcode}</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
      <style>{`@keyframes tlpulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.9);opacity:0}}`}</style>
    </div>
  )
}
