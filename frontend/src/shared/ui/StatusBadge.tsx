type Tone = 'yellow' | 'blue' | 'green' | 'red' | 'gray' | 'purple'

interface Props {
  tone: Tone
  children: React.ReactNode
  dot?: boolean
}

// Har bir tonni — matn rangi + mos yarim-shaffof fon (mockup uslubi)
const tones: Record<Tone, { color: string; bg: string }> = {
  yellow: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  blue:   { color: '#4dd4e8', bg: 'rgba(77,212,232,0.12)' },
  green:  { color: '#3ddc84', bg: 'rgba(61,220,132,0.12)' },
  red:    { color: 'var(--brand-light)', bg: 'var(--brand-tint)' },
  gray:   { color: 'var(--text-muted)', bg: 'var(--card-3)' },
  purple: { color: '#c4b5fd', bg: 'rgba(167,139,250,0.12)' },
}

export function StatusBadge({ tone, children, dot }: Props) {
  const s = tones[tone]
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
      style={{ color: s.color, background: s.bg }}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />}
      {children}
    </span>
  )
}
