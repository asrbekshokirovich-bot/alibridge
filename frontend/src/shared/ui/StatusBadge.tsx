type Tone = 'yellow' | 'blue' | 'green' | 'red' | 'gray' | 'purple'

interface Props {
  tone: Tone
  children: React.ReactNode
  dot?: boolean
}

const tones: Record<Tone, string> = {
  yellow: 'bg-amber-50 text-amber-700',
  blue: 'bg-blue-50 text-blue-700',
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-50 text-red-600',
  gray: 'bg-slate-100 text-slate-600',
  purple: 'bg-purple-50 text-purple-700',
}

const dots: Record<Tone, string> = {
  yellow: 'bg-amber-500',
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  red: 'bg-red-500',
  gray: 'bg-slate-400',
  purple: 'bg-purple-500',
}

export function StatusBadge({ tone, children, dot }: Props) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${tones[tone]}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dots[tone]}`} />}
      {children}
    </span>
  )
}
