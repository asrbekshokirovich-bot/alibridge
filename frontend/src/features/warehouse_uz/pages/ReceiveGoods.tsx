import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import type { ProductType } from '@/shared/types'
import { Header, Button, Input } from '@/shared/ui'

interface ReceiveResult {
  barcode: string
  name: string
  received_date: string
  print_url: string
  quantity: number
}

// Donali uchun vazn kiritish usuli
type WeightMode = 'unit' | 'total'

const TYPES: { key: ProductType; label: string; emoji: string }[] = [
  { key: 'piece', label: 'Donali', emoji: '📦' },
  { key: 'boxed', label: 'Kiloli', emoji: '🗳️' },
  { key: 'textile', label: 'Tekstil', emoji: '🧵' },
]

const emptyForm = {
  name: '',
  category: '',
  type: 'piece' as ProductType,
  quantity: '',
  weight_kg: '',
  unit_weight_kg: '',
  box_count: '',
  units_per_box: '',
  box_weight_kg: '',
  cargo_price: '',
}

export default function ReceiveGoods() {
  const navigate = useNavigate()
  const { notify, haptic } = useTelegram()

  const [form, setForm] = useState(emptyForm)
  const [weightMode, setWeightMode] = useState<WeightMode>('total') // donali: umumiy/1 dona
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ReceiveResult | null>(null)

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const num = (s: string) => parseFloat(s) || 0

  const isPiece = form.type === 'piece'
  const isBoxed = form.type === 'boxed'
  const isTextile = form.type === 'textile'
  const pricePerKg = isBoxed || isTextile

  // Kiloli: jonli hisob (quti × soni, quti × kg)
  const boxedTotalQty = num(form.box_count) * num(form.units_per_box)
  const boxedTotalKg = num(form.box_count) * num(form.box_weight_kg)

  // Forma to'lganmi
  const valid = (() => {
    if (!form.name.trim() || !form.cargo_price) return false
    if (isPiece) {
      if (!form.quantity) return false
      return weightMode === 'unit' ? !!form.unit_weight_kg : !!form.weight_kg
    }
    if (isBoxed) return !!form.box_count && !!form.units_per_box && !!form.box_weight_kg
    if (isTextile) return !!form.quantity && !!form.weight_kg
    return false
  })()

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!valid || loading) return
    setLoading(true)
    setError('')
    try {
      // Turga qarab payload
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        category: form.category.trim(),
        type: form.type,
        cargo_price: parseInt(form.cargo_price, 10),
      }
      if (isPiece) {
        payload.quantity = parseInt(form.quantity, 10)
        if (weightMode === 'unit') payload.unit_weight_kg = num(form.unit_weight_kg)
        else payload.weight_kg = num(form.weight_kg)
      } else if (isBoxed) {
        payload.box_count = parseInt(form.box_count, 10)
        payload.units_per_box = parseInt(form.units_per_box, 10)
        payload.box_weight_kg = num(form.box_weight_kg)
      } else if (isTextile) {
        payload.quantity = parseInt(form.quantity, 10)
        payload.weight_kg = num(form.weight_kg)
      }

      const res = await client.post<ReceiveResult>('/warehouse-uz/receive', payload)
      notify('success')
      setResult(res.data)
    } catch (err) {
      setError(extractErrorMessage(err))
      notify('error')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setResult(null)
    setForm(emptyForm)
    setWeightMode('total')
  }

  // ─── Barkod natija ekrani ───────────────────────────────────────────────
  if (result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 animate-scale-in">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
          style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 12px 32px rgba(34,197,94,0.4)' }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Yuk qabul qilindi!</h2>
        <p className="text-sm text-slate-500 mb-5">Barkod yaratildi — chiqaring va yopishtiring</p>

        {/* Yorliq: nom + sana tepada, shtrix pastda */}
        <div className="w-full bg-white rounded-2xl border-2 border-dashed border-slate-300 p-5 mt-1 text-center">
          <p className="text-base font-bold text-slate-900 truncate">{result.name}</p>
          <p className="text-xs text-slate-500 mb-3">{result.received_date}</p>
          <div className="flex justify-center items-end gap-[2px] mb-1.5 h-14">
            {Array.from({ length: 40 }).map((_, i) => (
              <div key={i} className="bg-slate-900" style={{ width: i % 4 === 0 ? 3 : i % 3 === 0 ? 1 : 2, height: '100%' }} />
            ))}
          </div>
          <p className="font-mono text-sm font-bold tracking-widest text-slate-900">{result.barcode}</p>
        </div>

        <a
          href={result.print_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ background: 'var(--brand-gradient)' }}
          className="press w-full text-white rounded-2xl py-4 font-bold mt-5 text-center shadow-[var(--shadow-brand)]"
        >
          🖨️ Barkod chiqarish
        </a>
        <button onClick={reset} className="press w-full bg-slate-100 text-slate-700 rounded-2xl py-3.5 font-semibold mt-3">
          Yangi yuk qabul qilish
        </button>
        <button onClick={() => navigate('/warehouse-uz')} className="press text-slate-400 text-sm font-medium mt-3">
          Bosh sahifaga
        </button>
      </div>
    )
  }

  // ─── Forma ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-32 animate-fade-in">
      <Header title="Yuk qabul qilish" subtitle="Yangi mahsulot kiritish" showBack />

      <form onSubmit={handleSubmit} className="px-4 pt-5 space-y-4">
        <Input label="Mahsulot nomi" placeholder="Masalan: Krasovka Nike" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        <Input label="Kategoriya" placeholder="Poyabzal, tekstil, elektronika..." value={form.category} onChange={(e) => set('category', e.target.value)} />

        {/* Yuk turi — 3 ta */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Yuk turi</label>
          <div className="bg-slate-100 rounded-2xl p-1 grid grid-cols-3 gap-1">
            {TYPES.map((opt) => {
              const active = form.type === opt.key
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => { haptic('light'); set('type', opt.key) }}
                  className={`py-2.5 rounded-xl text-[13px] font-semibold transition-all flex flex-col items-center gap-0.5 ${active ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                >
                  <span className="text-base leading-none">{opt.emoji}</span>
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── DONALI ── */}
        {isPiece && (
          <div className="space-y-4 animate-fade-in">
            <Input type="number" inputMode="numeric" label="Soni (dona)" placeholder="600" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} required />

            {/* Vazn usuli: 1 dona / umumiy */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Vaznni qanday kiritasiz?</label>
              <div className="bg-slate-100 rounded-2xl p-1 grid grid-cols-2 gap-1 mb-2">
                {([
                  { key: 'total' as const, label: 'Umumiy vazn' },
                  { key: 'unit' as const, label: '1 dona vazni' },
                ]).map((opt) => {
                  const active = weightMode === opt.key
                  return (
                    <button key={opt.key} type="button" onClick={() => { haptic('light'); setWeightMode(opt.key) }}
                      className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${active ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              {weightMode === 'total' ? (
                <Input type="number" inputMode="decimal" label="Umumiy vazn (kg)" placeholder="480" value={form.weight_kg} onChange={(e) => set('weight_kg', e.target.value)} required />
              ) : (
                <Input type="number" inputMode="decimal" label="1 dona vazni (kg)" placeholder="0.8" value={form.unit_weight_kg} onChange={(e) => set('unit_weight_kg', e.target.value)} required />
              )}
              {/* Avto-hisob ko'rsatkichi */}
              {weightMode === 'total' && num(form.quantity) > 0 && num(form.weight_kg) > 0 && (
                <p className="text-xs text-slate-500 mt-1.5">≈ 1 dona vazni: <b className="text-slate-700">{(num(form.weight_kg) / num(form.quantity)).toFixed(3)} kg</b></p>
              )}
              {weightMode === 'unit' && num(form.quantity) > 0 && num(form.unit_weight_kg) > 0 && (
                <p className="text-xs text-slate-500 mt-1.5">≈ Umumiy vazn: <b className="text-slate-700">{(num(form.quantity) * num(form.unit_weight_kg)).toFixed(1)} kg</b></p>
              )}
            </div>
          </div>
        )}

        {/* ── KILOLI (qutili) ── */}
        {isBoxed && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex gap-3">
              <Input type="number" inputMode="numeric" label="Quti soni" placeholder="50" value={form.box_count} onChange={(e) => set('box_count', e.target.value)} required />
              <Input type="number" inputMode="numeric" label="1 qutidagi soni" placeholder="20" value={form.units_per_box} onChange={(e) => set('units_per_box', e.target.value)} required />
            </div>
            <Input type="number" inputMode="decimal" label="1 quti vazni (kg)" placeholder="2" value={form.box_weight_kg} onChange={(e) => set('box_weight_kg', e.target.value)} required />
            {/* Jonli hisob */}
            {boxedTotalQty > 0 && (
              <div className="rounded-2xl p-3.5 space-y-1.5" style={{ background: 'var(--brand-gradient-soft)' }}>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Jami mahsulot</span><span className="font-bold text-slate-900">{boxedTotalQty} dona</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Jami vazn</span><span className="font-bold text-slate-900">{boxedTotalKg.toFixed(1)} kg</span></div>
              </div>
            )}
          </div>
        )}

        {/* ── TEKSTIL ── */}
        {isTextile && (
          <div className="flex gap-3 animate-fade-in">
            <Input type="number" inputMode="numeric" label="Soni (dona)" placeholder="100" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} required />
            <Input type="number" inputMode="decimal" label="Umumiy (kg)" placeholder="100" value={form.weight_kg} onChange={(e) => set('weight_kg', e.target.value)} required />
          </div>
        )}

        {/* Narx — turga qarab */}
        <Input
          type="number"
          inputMode="decimal"
          label={pricePerKg ? 'Olib ketish narxi ($ / 1 kg)' : 'Olib ketish narxi ($ / 1 dona)'}
          placeholder="Dollarda ($)"
          value={form.cargo_price}
          onChange={(e) => set('cargo_price', e.target.value)}
          required
        />

        {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl">{error}</div>}
      </form>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100">
        <Button fullWidth loading={loading} disabled={!valid} onClick={() => handleSubmit()}>
          Qabul qilish va barkod yaratish
        </Button>
      </div>
    </div>
  )
}
