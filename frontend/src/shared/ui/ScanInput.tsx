import { useRef, useEffect } from 'react'
import { IconScan } from './icons'

interface Props {
  value: string
  onChange: (v: string) => void
  // Skanlangan barkodni uzatadi (Enter yoki "Skan" tugmasi). Input darhol tozalanadi.
  onScan: (barcode: string) => void
  loading?: boolean
  placeholder?: string
}

export function ScanInput({ value, onChange, onScan, loading, placeholder = 'Barkodni skanlang' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Pistoletcha skaner Enter yuboradi — avtofokus muhim.
  // Fokus YO'QOLSA qayta tiklaymiz, LEKIN foydalanuvchi boshqa interaktiv
  // elementni (tugma, input, ssilka) bosган bo'lsa tegmaymiz — aks holda
  // miqdor +/−/🗑️ tugmalarini bosib bo'lmaydi (fokus darhol o'g'irlanadi).
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus()
    const INTERACTIVE = new Set(['INPUT', 'TEXTAREA', 'BUTTON', 'A', 'SELECT'])
    const refocus = () => {
      // blur'dan keyin fokus qayerga ketganini aniqlash uchun keyingi tick'ni kutamiz
      setTimeout(() => {
        const active = document.activeElement
        if (active && active !== el && (INTERACTIVE.has(active.tagName) || (active as HTMLElement).isContentEditable)) {
          return // foydalanuvchi atayin boshqa elementга o'tdi — fokusni o'g'irlamaymiz
        }
        el.focus()
      }, 0)
    }
    el.addEventListener('blur', refocus)
    return () => el.removeEventListener('blur', refocus)
  }, [])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const bc = value.trim()
    if (!bc) return
    onScan(bc)
    onChange('')          // darhol tozalaymiz — keyingi skan uchun tayyor
    inputRef.current?.focus()
  }

  return (
    <form onSubmit={submit} className="p-4">
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
          disabled={!value.trim()}
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
