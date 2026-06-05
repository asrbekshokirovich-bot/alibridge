import { useRef, useEffect } from 'react'
import { IconScan } from './icons'

interface Props {
  value: string
  onChange: (v: string) => void
  onScan: () => void
  loading?: boolean
  placeholder?: string
}

export function ScanInput({ value, onChange, onScan, loading, placeholder = 'Barkodni skanlang' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Pistoletcha skaner odatda Enter yuboradi — avtofokus muhim
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim()) onScan()
  }

  return (
    <form onSubmit={handleSubmit} className="p-4">
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-red-400 pointer-events-none">
          <IconScan size={22} />
        </div>
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-12 pr-24 py-4 bg-white border-2 border-slate-200 rounded-2xl font-mono text-[15px] focus:border-red-400 focus:outline-none transition-colors shadow-sm"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          style={{ background: 'var(--brand-gradient)' }}
          className="press absolute right-2 top-1/2 -translate-y-1/2 text-white text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-40"
        >
          {loading ? '...' : 'Skan'}
        </button>
      </div>
      <p className="text-xs text-slate-400 mt-2 text-center">📷 Pistoletcha bilan skanlang yoki qo'lda kiriting</p>
    </form>
  )
}
