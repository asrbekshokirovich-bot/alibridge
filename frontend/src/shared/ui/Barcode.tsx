interface Props {
  /** Kuzatuv kodi (barkod matni) */
  value: string
  height?: number
  className?: string
}

// Yengil, deterministik barkod ko'rinishi — haqiqiy skanlanadigan emas, vizual.
// Kod matnidan barqaror (har doim bir xil) chiziq naqshini hosil qiladi.
function bars(value: string): number[] {
  const out: number[] = []
  let seed = 0
  for (let i = 0; i < value.length; i++) seed = (seed * 31 + value.charCodeAt(i)) >>> 0
  // ~44 ta chiziq — kenglik 1..3, oraliq 1..2
  for (let i = 0; i < 44; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0
    out.push(1 + ((seed >>> 8) % 3)) // bar width
    out.push(1 + ((seed >>> 16) % 2)) // gap width (manfiy ishorada saqlanmaydi — pastda hisoblanadi)
  }
  return out
}

export function Barcode({ value, height = 44, className = '' }: Props) {
  const widths = bars(value)
  let x = 0
  const rects: React.ReactNode[] = []
  for (let i = 0; i < widths.length; i += 2) {
    const w = widths[i]
    const gap = widths[i + 1]
    rects.push(<rect key={i} x={x} y={0} width={w} height={height} fill="var(--text)" />)
    x += w + gap
  }
  return (
    <svg
      className={className}
      width="100%"
      height={height}
      viewBox={`0 0 ${x} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={value}
    >
      {rects}
    </svg>
  )
}
