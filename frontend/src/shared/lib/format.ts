// Umumiy formatlash yordamchilari

// Ism-familiyadan bosh harflar (bo'sh bo'lsa '?')
export function initials(first?: string, last?: string): string {
  const a = first?.trim()?.[0] ?? ''
  const b = last?.trim()?.[0] ?? ''
  return (a + b).toUpperCase() || '?'
}

// Pul formatlash (dollarda): 1500 → "$1,500"
export function money(n: number): string {
  return '$' + n.toLocaleString('en-US')
}
