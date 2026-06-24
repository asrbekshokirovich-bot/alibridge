type Tone = 'yellow' | 'blue' | 'green' | 'red' | 'gray' | 'purple'

interface Props {
  tone: Tone
  children: React.ReactNode
  dot?: boolean
}

/**
 * v2 (redesign): fon/chegara biroz to'qroq (kontrast), dot uchun nozik glow.
 * Ranglar o'zgarmagan — green=Tugadi, red=aktiv/Yo'lovchida, blue/purple=jarayonda,
 * amber=kutilmoqda, gray=neytral.
 */
const tones: Record<Tone, { color: string; bg: string; border: string }> = {
  green:  { color: '#34d399', bg: 'rgba(52,211,153,0.16)', border: 'rgba(52,211,153,0.34)' },
  red:    { color: '#ff8a8a', bg: 'rgba(255,107,107,0.16)', border: 'rgba(255,107,107,0.36)' },
  blue:   { color: '#6aa3ff', bg: 'rgba(106,163,255,0.16)', border: 'rgba(106,163,255,0.34)' },
  purple: { color: '#c4b5fd', bg: 'rgba(167,139,250,0.16)', border: 'rgba(167,139,250,0.34)' },
  yellow: { color: '#fbbf24', bg: 'rgba(251,191,36,0.16)', border: 'rgba(251,191,36,0.34)' },
  gray:   { color: '#9bb0d2', bg: 'rgba(255,255,255,0.07)', border: 'rgba(255,255,255,0.14)' },
}

export function StatusBadge({ tone, children, dot }: Props) {
  const s = tones[tone]
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }} />}
      {children}
    </span>
  )
}
