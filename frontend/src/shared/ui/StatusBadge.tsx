type Tone = 'yellow' | 'blue' | 'green' | 'red' | 'gray' | 'purple'

interface Props {
  tone: Tone
  children: React.ReactNode
  dot?: boolean
}

// Dark glass'ga uyg'un status piллари — rang + mos yarim-shaffof fon.
// green=Tugadi, red/coral=aktiv "Hozir"/Yo'lovchida, blue/purple=jarayonda, amber=kutilmoqda.
const tones: Record<Tone, { color: string; bg: string; border: string }> = {
  green:  { color: '#34d399', bg: 'rgba(52,211,153,0.14)', border: 'rgba(52,211,153,0.28)' },
  red:    { color: '#ff8a8a', bg: 'rgba(255,107,107,0.14)', border: 'rgba(255,107,107,0.30)' },
  blue:   { color: '#6aa3ff', bg: 'rgba(106,163,255,0.14)', border: 'rgba(106,163,255,0.28)' },
  purple: { color: '#c4b5fd', bg: 'rgba(167,139,250,0.14)', border: 'rgba(167,139,250,0.28)' },
  yellow: { color: '#fbbf24', bg: 'rgba(251,191,36,0.14)', border: 'rgba(251,191,36,0.28)' },
  gray:   { color: '#8ba0c4', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)' },
}

export function StatusBadge({ tone, children, dot }: Props) {
  const s = tones[tone]
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />}
      {children}
    </span>
  )
}
