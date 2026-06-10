import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import client from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import type { Product, ProductVariant, CartItem } from '@/shared/types'
import { money } from '@/shared/lib/format'
import { isPiece, typeLabel, typeEmoji, unitWord } from '@/shared/lib/product'
import { Header, ListSkeleton, EmptyState, Sheet } from '@/shared/ui'

// Donali uchun og'irlik = dona × 1 dona vazni; kiloli/tekstil uchun = kiritilgan kg
function calcWeight(p: Product, v: ProductVariant, amount: number): number {
  return isPiece(p.type) ? amount * (v.unit_weight_kg ?? 0) : amount
}
function calcPrice(v: ProductVariant, amount: number): number {
  return amount * v.cargo_price
}
function maxAmount(p: Product, v: ProductVariant): number {
  return isPiece(p.type) ? v.quantity : v.weight_kg
}

// Faqat to'ldirilgan variantlar (bo'sh backfill emas)
function realVariants(p: Product): ProductVariant[] {
  return (p.variants ?? []).filter((v) => v.size_label || v.quantity || v.weight_kg)
}

export default function Products() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const [cart, setCart] = useState<CartItem[]>([])
  const [open, setOpen] = useState<Product | null>(null)

  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => client.get<Product[]>('/products/catalog').then((r) => r.data),
  })

  const inCart = (variantId: number) => cart.find((c) => c.variant.id === variantId)

  // Miqdorni o'zgartirish (donali: 1 dona qadam, kiloli/tekstil: 1 kg qadam)
  const setAmount = (p: Product, v: ProductVariant, next: number) => {
    const max = maxAmount(p, v)
    const clamped = Math.max(0, Math.min(next, max))
    setCart((prev) => {
      const rest = prev.filter((c) => c.variant.id !== v.id)
      if (clamped <= 0) return rest
      return [...rest, { product: p, variant: v, amount: clamped, weight: calcWeight(p, v, clamped), price: calcPrice(v, clamped) }]
    })
  }

  const select = (p: Product, v: ProductVariant) => { haptic('light'); setAmount(p, v, 1) }
  const inc = (p: Product, v: ProductVariant, cur: number) => { haptic('light'); setAmount(p, v, cur + 1) }
  const dec = (p: Product, v: ProductVariant, cur: number) => { haptic('light'); setAmount(p, v, cur - 1) }

  // Mahsulot kartasi uchun: nechta o'lcham savatda
  const productCartCount = (p: Product) => realVariants(p).filter((v) => inCart(v.id)).length
  const cartCount = cart.length

  // Kartada ko'rsatiladigan narx oralig'i
  const priceRange = (p: Product) => {
    const vs = realVariants(p)
    const prices = vs.map((v) => v.cargo_price).filter((x) => x > 0)
    if (!prices.length) return null
    const min = Math.min(...prices), max = Math.max(...prices)
    return min === max ? money(min) : `${money(min)}–${money(max)}`
  }

  return (
    <div className="min-h-screen pb-28 animate-fade-in">
      <Header title="Mahsulotlar" subtitle="O'zingizga mos yukni tanlang" />

      {isLoading ? (
        <ListSkeleton />
      ) : !products?.length ? (
        <EmptyState title="Mahsulot topilmadi" description="Hozircha mahsulot yo'q" />
      ) : (
        <div className="px-3 pt-3 grid grid-cols-2 gap-3">
          {products.map((p) => {
            const vs = realVariants(p)
            if (vs.length === 0) return null
            const selectedCount = productCartCount(p)
            const unit = unitWord(p.type)
            const pr = priceRange(p)
            return (
              <button key={p.id} onClick={() => { haptic('light'); setOpen(p) }}
                className={`text-left bg-white rounded-2xl overflow-hidden border-2 flex flex-col transition-colors ${selectedCount > 0 ? 'border-red-400' : 'border-slate-100'}`}>
                {/* Rasm */}
                <div className="aspect-square bg-slate-50 flex items-center justify-center overflow-hidden relative">
                  {p.image_url
                    ? <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-5xl">{typeEmoji(p.type)}</span>}
                  {selectedCount > 0 && (
                    <span className="absolute top-2 right-2 bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">{selectedCount} o'lcham</span>
                  )}
                </div>

                <div className="p-2.5 flex flex-col gap-1 flex-1">
                  <span className={`self-start text-[10px] font-bold px-2 py-0.5 rounded ${isPiece(p.type) ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                    {typeLabel(p.type)}
                  </span>
                  <h3 className="text-[14px] font-bold text-slate-900 leading-tight line-clamp-2">{p.category || p.name}</h3>
                  {pr && (
                    <div className="text-[15px] font-bold leading-tight" style={{ color: 'var(--brand)' }}>
                      {pr}<span className="text-xs font-medium text-slate-400">/{unit}</span>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 mt-auto pt-1">{vs.length} o'lcham mavjud →</p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* O'lchamlar Sheet */}
      <Sheet open={!!open} onClose={() => setOpen(null)}>
        {open && (
          <div className="px-5 pt-2 pb-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                {open.image_url
                  ? <img src={open.image_url} alt="" className="w-full h-full object-cover" />
                  : <span className="text-3xl">{typeEmoji(open.type)}</span>}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 truncate">{open.category || open.name}</h3>
                <p className="text-xs text-slate-400">O'lchamni tanlang</p>
              </div>
            </div>
            <div className="space-y-2.5">
              {realVariants(open).map((v) => {
                const item = inCart(v.id)
                const amount = item?.amount ?? 0
                const selected = amount > 0
                const unit = unitWord(open.type)
                const max = maxAmount(open, v)
                return (
                  <div key={v.id} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                    <span className="w-11 h-11 rounded-lg bg-white flex items-center justify-center font-bold text-slate-700 shrink-0">
                      {v.size_label || '—'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold" style={{ color: 'var(--brand)' }}>
                        {money(v.cargo_price)}<span className="text-xs font-medium text-slate-400">/{unit}</span>
                      </p>
                      <p className="text-[11px] text-slate-400">{max} {unit} mavjud</p>
                    </div>
                    <div className="shrink-0 w-[120px]">
                      {selected ? (
                        <div className="flex items-center justify-between rounded-xl overflow-hidden" style={{ background: 'var(--brand-gradient)' }}>
                          <button onClick={() => dec(open, v, amount)} className="press w-9 h-9 flex items-center justify-center text-white text-xl font-bold">−</button>
                          <span className="text-white text-sm font-bold tabular-nums">{amount}</span>
                          <button onClick={() => inc(open, v, amount)} disabled={amount >= max}
                            className="press w-9 h-9 flex items-center justify-center text-white text-xl font-bold disabled:opacity-40">+</button>
                        </div>
                      ) : (
                        <button onClick={() => select(open, v)} disabled={max <= 0}
                          className="press w-full h-9 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: 'var(--brand-gradient)' }}>
                          Tanlash
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Sheet>

      {/* Suzuvchi tasdiqlash */}
      {cartCount > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-[480px] px-4 z-20 animate-slide-up">
          <button onClick={() => { haptic('medium'); navigate('/carrier/ticket', { state: { cart } }) }}
            style={{ background: 'var(--brand-gradient)' }}
            className="press w-full text-white rounded-2xl py-4 font-bold shadow-[var(--shadow-brand)] flex items-center justify-center gap-2">
            Tasdiqlash
            <span className="bg-white/25 px-2.5 py-0.5 rounded-full text-sm">{cartCount}</span>
          </button>
        </div>
      )}
    </div>
  )
}
