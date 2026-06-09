import { useRef, useState } from 'react'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import type { Product, ProductType, ProductVariant } from '@/shared/types'
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
  initial?: Product
  submitLabel: string
  onSaved: (updated: Product) => void
}

export default function ProductDetailsForm({ productId, initial, submitLabel, onSaved }: Props) {
  const { notify, haptic } = useTelegram()

  const initType: ProductType = initial ? (productGroup(initial.type) as ProductType) : 'piece'

  const [type, setType] = useState<ProductType>(initType)
  // Qo'shilgan variantlar (serverdan kelgan)
  const [variants, setVariants] = useState<ProductVariant[]>(initial?.variants?.filter((v) => v.size_label || v.quantity || v.weight_kg) ?? [])

  // Joriy o'lcham kiritish maydonlari
  const [size, setSize] = useState('')
  const [quantity, setQuantity] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [unitWeight, setUnitWeight] = useState('')
  const [boxCount, setBoxCount] = useState('')
  const [unitsPerBox, setUnitsPerBox] = useState('')
  const [boxWeight, setBoxWeight] = useState('')
  const [tare, setTare] = useState('')
  const [cargoPrice, setCargoPrice] = useState('')
  const [weightMode, setWeightMode] = useState<WeightMode>('total')

  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Rasm (majburiy)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? '')
  const [imagePreview, setImagePreview] = useState('')
  const [uploading, setUploading] = useState(false)

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImagePreview(URL.createObjectURL(file))
    setUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await client.post<Product>(`/warehouse-uz/products/${productId}/image`, fd)
      setImageUrl(res.data.image_url ?? '')
      notify('success')
    } catch (err) {
      setError(extractErrorMessage(err))
      setImagePreview('')
      notify('error')
    } finally {
      setUploading(false)
    }
  }

  const n = (s: string) => parseFloat(s) || 0
  const isPiece = type === 'piece'
  const isBoxed = type === 'boxed'
  const isTextile = type === 'textile'
  const pricePerKg = isBoxed || isTextile

  // Joriy o'lcham maydonlaridan kamida bittasi to'ldirilganmi
  const currentFilled = (() => {
    if (isPiece) return !!quantity || !!weightKg || !!unitWeight || !!tare || !!cargoPrice
    if (isBoxed) return !!quantity || !!boxCount || !!unitsPerBox || !!boxWeight || !!tare || !!cargoPrice
    return !!quantity || !!weightKg || !!tare || !!cargoPrice
  })()

  const resetCurrent = () => {
    setSize(''); setQuantity(''); setWeightKg(''); setUnitWeight('')
    setBoxCount(''); setUnitsPerBox(''); setBoxWeight(''); setTare(''); setCargoPrice('')
  }

  const buildPayload = () => {
    const payload: Record<string, unknown> = { type, size_label: size.trim() }
    if (cargoPrice) payload.cargo_price = parseInt(cargoPrice, 10)
    if (tare) payload.tare_kg = n(tare)
    if (isPiece) {
      if (quantity) payload.quantity = parseInt(quantity, 10)
      if (weightMode === 'unit') { if (unitWeight) payload.unit_weight_kg = n(unitWeight) }
      else if (weightKg) payload.weight_kg = n(weightKg)
    } else if (isBoxed) {
      if (quantity) payload.quantity = parseInt(quantity, 10)
      if (boxCount) payload.box_count = parseInt(boxCount, 10)
      if (unitsPerBox) payload.units_per_box = parseInt(unitsPerBox, 10)
      if (boxWeight) payload.box_weight_kg = n(boxWeight)
    } else if (isTextile) {
      if (quantity) payload.quantity = parseInt(quantity, 10)
      if (weightKg) payload.weight_kg = n(weightKg)
    }
    return payload
  }

  // Joriy o'lchamni serverga qo'shadi va maydonlarni tozalaydi
  const addVariant = async (): Promise<Product | null> => {
    setAdding(true)
    setError('')
    try {
      const res = await client.post<Product>(`/warehouse-uz/products/${productId}/variants`, buildPayload())
      setVariants(res.data.variants)
      resetCurrent()
      notify('success')
      return res.data
    } catch (err) {
      setError(extractErrorMessage(err))
      notify('error')
      return null
    } finally {
      setAdding(false)
    }
  }

  const removeVariant = async (variantId: number) => {
    setError('')
    try {
      const res = await client.delete<Product>(`/warehouse-uz/products/${productId}/variants/${variantId}`)
      setVariants(res.data.variants)
      haptic('light')
    } catch (err) {
      setError(extractErrorMessage(err))
    }
  }

  // "Qabul qilish": agar joriy o'lcham to'ldirilgan bo'lsa avval uni qo'shamiz, keyin tugatamiz
  const finish = async () => {
    if (loading || adding) return
    if (!imageUrl) { setError('Rasm majburiy'); return }

    let last: Product | null = null
    if (currentFilled) {
      last = await addVariant()
      if (!last) return // xato bo'ldi
    }
    if (variants.length === 0 && !last) {
      setError("Kamida bitta o'lcham qo'shing")
      return
    }
    setLoading(true)
    try {
      // Eng so'nggi product holatini olamiz (yoki addVariant qaytargan)
      const res = last ? { data: last } : await client.get<Product>(`/warehouse-uz/products/${productId}`)
      notify('success')
      onSaved(res.data)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const variantSummary = (v: ProductVariant) => {
    const parts: string[] = []
    if (v.quantity) parts.push(`${v.quantity} dona`)
    if (v.weight_kg) parts.push(`${v.weight_kg} kg`)
    if (v.cargo_price) parts.push(`$${v.cargo_price}/${productGroup(type) === 'piece' ? 'dona' : 'kg'}`)
    return parts.join(' · ') || '—'
  }

  return (
    <>
      <div className="px-4 pt-5 space-y-4">
        {/* Rasm (majburiy) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Mahsulot rasmi <span className="text-red-500">*</span>
          </label>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickImage} />
          {imageUrl || imagePreview ? (
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="press relative w-full aspect-square max-h-64 rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-50">
              <img src={imagePreview || imageUrl} alt="" className="w-full h-full object-cover" />
              {uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">Yuklanmoqda…</span>
                </div>
              )}
              <span className="absolute bottom-2 right-2 bg-white/90 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-lg">📷 O'zgartirish</span>
            </button>
          ) : (
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="press w-full aspect-square max-h-64 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center gap-2 text-slate-400">
              <span className="text-4xl">📷</span>
              <span className="text-sm font-semibold">{uploading ? 'Yuklanmoqda…' : 'Suratga olish'}</span>
            </button>
          )}
        </div>

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

        {/* Qo'shilgan o'lchamlar ro'yxati */}
        {variants.length > 0 && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Qo'shilgan o'lchamlar ({variants.length})</label>
            {variants.map((v) => (
              <div key={v.id} className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
                <span className="w-10 h-10 rounded-lg bg-white flex items-center justify-center font-bold text-slate-700 shrink-0 text-sm">
                  {v.size_label || '—'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500">O'lcham: <b className="text-slate-800">{v.size_label || 'yo\'q'}</b></p>
                  <p className="text-[11px] text-slate-400">{variantSummary(v)}</p>
                </div>
                <button type="button" onClick={() => removeVariant(v.id)} className="press text-red-500 text-xs font-semibold shrink-0">O'chirish</button>
              </div>
            ))}
          </div>
        )}

        {/* Joriy o'lcham kiritish */}
        <div className="rounded-2xl border-2 border-slate-100 p-3.5 space-y-4">
          <Input label="O'lcham (39, M, L...)" placeholder="O'lchamni yozing" value={size} onChange={(e) => setSize(e.target.value)} />

          {/* DONALI */}
          {isPiece && (
            <>
              <Input type="number" inputMode="numeric" label="Soni (dona)" placeholder="600" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              <div>
                <div className="bg-slate-100 rounded-2xl p-1 grid grid-cols-2 gap-1 mb-2">
                  {([{ key: 'total' as const, label: 'Umumiy vazn' }, { key: 'unit' as const, label: '1 dona vazni' }]).map((opt) => (
                    <button key={opt.key} type="button" onClick={() => { haptic('light'); setWeightMode(opt.key) }}
                      className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${weightMode === opt.key ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {weightMode === 'total' ? (
                  <Input type="number" inputMode="decimal" label="Umumiy vazn (kg)" placeholder="480" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
                ) : (
                  <Input type="number" inputMode="decimal" label="1 dona vazni (kg)" placeholder="0.8" value={unitWeight} onChange={(e) => setUnitWeight(e.target.value)} />
                )}
              </div>
            </>
          )}

          {/* KILOLI */}
          {isBoxed && (
            <>
              <Input type="number" inputMode="numeric" label="Soni (dona)" placeholder="1000" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              <div className="flex gap-3">
                <Input type="number" inputMode="numeric" label="Quti soni" placeholder="50" value={boxCount} onChange={(e) => setBoxCount(e.target.value)} />
                <Input type="number" inputMode="numeric" label="1 qutidagilar" placeholder="20" value={unitsPerBox} onChange={(e) => setUnitsPerBox(e.target.value)} />
              </div>
              <Input type="number" inputMode="decimal" label="1 quti vazni (kg)" placeholder="2" value={boxWeight} onChange={(e) => setBoxWeight(e.target.value)} />
            </>
          )}

          {/* TEKSTIL */}
          {isTextile && (
            <div className="flex gap-3">
              <Input type="number" inputMode="numeric" label="Soni (dona)" placeholder="100" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              <Input type="number" inputMode="decimal" label="Umumiy vazn (kg)" placeholder="100" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
            </div>
          )}

          <Input type="number" inputMode="decimal" label="Tara — qadoq vazni (kg)" placeholder="0" value={tare} onChange={(e) => setTare(e.target.value)} />
          <Input type="number" inputMode="decimal" label={pricePerKg ? 'Olib ketish narxi ($ / 1 kg)' : 'Olib ketish narxi ($ / 1 dona)'}
            placeholder="Dollarda ($)" value={cargoPrice} onChange={(e) => setCargoPrice(e.target.value)} />

          {/* + O'lcham qo'shish */}
          <Button variant="ghost" fullWidth loading={adding} disabled={!imageUrl || !currentFilled} onClick={addVariant}>
            + O'lcham qo'shish
          </Button>
        </div>

        {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl">{error}</div>}
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100">
        <Button fullWidth loading={loading} disabled={!imageUrl || (variants.length === 0 && !currentFilled)} onClick={finish}>
          {submitLabel}
        </Button>
      </div>
    </>
  )
}
