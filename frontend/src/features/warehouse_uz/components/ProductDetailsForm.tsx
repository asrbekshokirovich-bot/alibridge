import { useState } from 'react'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import type { Product, ProductType } from '@/shared/types'
import { productGroup } from '@/shared/lib/product'
import { Button, Input } from '@/shared/ui'

type WeightMode = 'unit' | 'total'

const TYPES: { key: ProductType; label: string; emoji: string }[] = [
  { key: 'piece', label: 'Donali', emoji: '📦' },
  { key: 'boxed', label: 'Kiloli', emoji: '🗳️' },
  { key: 'textile', label: 'Tekstil', emoji: '🧵' },
]

interface Props {
  productId: number
  // Tahrirlash uchun: mavjud qiymatlar (2-qadamda yo'q)
  initial?: Product
  submitLabel: string
  onSaved: (updated: Product) => void
}

export default function ProductDetailsForm({ productId, initial, submitLabel, onSaved }: Props) {
  const { notify, haptic } = useTelegram()

  // Tahrirlashda mavjud turni boshlang'ich qilamiz (eski 'weight' -> textile)
  const initType: ProductType = initial ? (productGroup(initial.type) as ProductType) : 'piece'

  const [type, setType] = useState<ProductType>(initType)
  const [quantity, setQuantity] = useState(initial?.quantity ? String(initial.quantity) : '')
  const [weightKg, setWeightKg] = useState(initial?.weight_kg ? String(initial.weight_kg) : '')
  const [unitWeight, setUnitWeight] = useState(initial?.unit_weight_kg ? String(initial.unit_weight_kg) : '')
  const [boxCount, setBoxCount] = useState(initial?.box_count ? String(initial.box_count) : '')
  const [unitsPerBox, setUnitsPerBox] = useState(initial?.units_per_box ? String(initial.units_per_box) : '')
  const [boxWeight, setBoxWeight] = useState(initial?.box_weight_kg ? String(initial.box_weight_kg) : '')
  const [cargoPrice, setCargoPrice] = useState(initial?.cargo_price ? String(initial.cargo_price) : '')
  const [weightMode, setWeightMode] = useState<WeightMode>('total')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const n = (s: string) => parseFloat(s) || 0
  const isPiece = type === 'piece'
  const isBoxed = type === 'boxed'
  const isTextile = type === 'textile'
  const pricePerKg = isBoxed || isTextile

  const boxedTotalQty = n(boxCount) * n(unitsPerBox)
  const boxedTotalKg = n(boxCount) * n(boxWeight)

  const valid = (() => {
    if (!cargoPrice) return false
    if (isPiece) return !!quantity && (weightMode === 'unit' ? !!unitWeight : !!weightKg)
    if (isBoxed) return !!boxCount && !!unitsPerBox && !!boxWeight
    if (isTextile) return !!quantity && !!weightKg
    return false
  })()

  const submit = async () => {
    if (!valid || loading) return
    setLoading(true)
    setError('')
    try {
      const payload: Record<string, unknown> = { type, cargo_price: parseInt(cargoPrice, 10) }
      if (isPiece) {
        payload.quantity = parseInt(quantity, 10)
        if (weightMode === 'unit') payload.unit_weight_kg = n(unitWeight)
        else payload.weight_kg = n(weightKg)
      } else if (isBoxed) {
        payload.box_count = parseInt(boxCount, 10)
        payload.units_per_box = parseInt(unitsPerBox, 10)
        payload.box_weight_kg = n(boxWeight)
      } else if (isTextile) {
        payload.quantity = parseInt(quantity, 10)
        payload.weight_kg = n(weightKg)
      }
      const res = await client.patch<Product>(`/warehouse-uz/products/${productId}`, payload)
      notify('success')
      onSaved(res.data)
    } catch (err) {
      setError(extractErrorMessage(err))
      notify('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="px-4 pt-5 space-y-4">
        {/* Yuk turi */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Yuk turi</label>
          <div className="bg-slate-100 rounded-2xl p-1 grid grid-cols-3 gap-1">
            {TYPES.map((opt) => {
              const active = type === opt.key
              return (
                <button key={opt.key} type="button" onClick={() => { haptic('light'); setType(opt.key) }}
                  className={`py-2.5 rounded-xl text-[13px] font-semibold transition-all flex flex-col items-center gap-0.5 ${active ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
                  <span className="text-base leading-none">{opt.emoji}</span>
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* DONALI */}
        {isPiece && (
          <div className="space-y-4 animate-fade-in">
            <Input type="number" inputMode="numeric" label="Soni (dona)" placeholder="600" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Vaznni qanday kiritasiz?</label>
              <div className="bg-slate-100 rounded-2xl p-1 grid grid-cols-2 gap-1 mb-2">
                {([{ key: 'total' as const, label: 'Umumiy vazn' }, { key: 'unit' as const, label: '1 dona vazni' }]).map((opt) => {
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
                <Input type="number" inputMode="decimal" label="Umumiy vazn (kg)" placeholder="480" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
              ) : (
                <Input type="number" inputMode="decimal" label="1 dona vazni (kg)" placeholder="0.8" value={unitWeight} onChange={(e) => setUnitWeight(e.target.value)} />
              )}
              {weightMode === 'total' && n(quantity) > 0 && n(weightKg) > 0 && (
                <p className="text-xs text-slate-500 mt-1.5">≈ 1 dona vazni: <b className="text-slate-700">{(n(weightKg) / n(quantity)).toFixed(3)} kg</b></p>
              )}
              {weightMode === 'unit' && n(quantity) > 0 && n(unitWeight) > 0 && (
                <p className="text-xs text-slate-500 mt-1.5">≈ Umumiy vazn: <b className="text-slate-700">{(n(quantity) * n(unitWeight)).toFixed(1)} kg</b></p>
              )}
            </div>
          </div>
        )}

        {/* KILOLI */}
        {isBoxed && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex gap-3">
              <Input type="number" inputMode="numeric" label="Quti soni" placeholder="50" value={boxCount} onChange={(e) => setBoxCount(e.target.value)} />
              <Input type="number" inputMode="numeric" label="1 qutidagi soni" placeholder="20" value={unitsPerBox} onChange={(e) => setUnitsPerBox(e.target.value)} />
            </div>
            <Input type="number" inputMode="decimal" label="1 quti vazni (kg)" placeholder="2" value={boxWeight} onChange={(e) => setBoxWeight(e.target.value)} />
            {boxedTotalQty > 0 && (
              <div className="rounded-2xl p-3.5 space-y-1.5" style={{ background: 'var(--brand-gradient-soft)' }}>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Jami mahsulot</span><span className="font-bold text-slate-900">{boxedTotalQty} dona</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Jami vazn</span><span className="font-bold text-slate-900">{boxedTotalKg.toFixed(1)} kg</span></div>
              </div>
            )}
          </div>
        )}

        {/* TEKSTIL */}
        {isTextile && (
          <div className="flex gap-3 animate-fade-in">
            <Input type="number" inputMode="numeric" label="Soni (dona)" placeholder="100" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <Input type="number" inputMode="decimal" label="Umumiy (kg)" placeholder="100" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
          </div>
        )}

        <Input type="number" inputMode="decimal" label={pricePerKg ? 'Olib ketish narxi ($ / 1 kg)' : 'Olib ketish narxi ($ / 1 dona)'}
          placeholder="Dollarda ($)" value={cargoPrice} onChange={(e) => setCargoPrice(e.target.value)} />

        {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl">{error}</div>}
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100">
        <Button fullWidth loading={loading} disabled={!valid} onClick={submit}>{submitLabel}</Button>
      </div>
    </>
  )
}
