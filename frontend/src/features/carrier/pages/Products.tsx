import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import client from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import type { Product, ProductVariant, CartItem } from '@/shared/types'
import { money } from '@/shared/lib/format'
import { isPiece, typeLabel, unitWord } from '@/shared/lib/product'
import { Header, ListSkeleton, EmptyState, Sheet, IconBox } from '@/shared/ui'

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
  const { t } = useTranslation()
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
      <Header title={t('Mahsulotlar')} subtitle={t("O'zingizga mos yukni tanlang")} />

      {isLoading ? (
        <ListSkeleton />
      ) : !products?.length ? (
        <EmptyState title={t('Mahsulot topilmadi')} description={t("Hozircha mahsulot yo'q")} />
      ) : (
        <div className="px-3 pt-3 grid grid-cols-2 gap-3 web-grid web-grid-catalog">
          {products.map((p) => {
            const vs = realVariants(p)
            if (vs.length === 0) return null
            const selectedCount = productCartCount(p)
            const unit = unitWord(p.type)
            const pr = priceRange(p)
            return (
              <button key={p.id} onClick={() => { haptic('light'); setOpen(p) }}
                className="press text-left rounded-[18px] overflow-hidden border flex flex-col transition-all"
                style={{
                  background: 'var(--card-gradient)',
                  borderColor: selectedCount > 0 ? 'var(--royal)' : 'var(--line2)',
                  boxShadow: selectedCount > 0 ? 'var(--glow-royal)' : 'var(--shadow-md)',
                }}>
                {/* Rasm */}
                <div className="aspect-square flex items-center justify-center overflow-hidden relative" style={{ background: 'var(--surface2)' }}>
                  {p.image_url
                    ? <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                    : <span style={{ color: 'var(--muted3)' }}><IconBox size={44} /></span>}
                  {/* Kategoriya pill (top-left) */}
                  <span className="absolute top-2.5 left-2.5 text-[10.5px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(106,163,255,0.14)', color: 'var(--brand-light)', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
                    {typeLabel(p.type)}
                  </span>
                  {selectedCount > 0 && (
                    <span className="absolute top-2.5 right-2.5 text-white text-[10.5px] font-bold px-2.5 py-1 rounded-full"
                      style={{ background: 'var(--royal)', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
                      {t("{{count}} o'lcham", { count: selectedCount })}
                    </span>
                  )}
                </div>

                <div className="p-3 flex flex-col gap-1.5 flex-1">
                  <h3 className="text-[14.5px] font-bold leading-tight line-clamp-2 tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>{p.category || p.name}</h3>
                  {pr && (
                    <div className="text-glow-lime text-[18.5px] font-extrabold leading-none tabular-nums tracking-[-0.02em]" style={{ color: 'var(--lime)' }}>
                      {pr}<span className="text-[11px] font-semibold ml-1" style={{ color: 'var(--muted3)' }}>so'm/{unit}</span>
                    </div>
                  )}
                  <p className="text-[11px] mt-auto pt-1" style={{ color: 'var(--muted3)' }}>{t("{{count}} o'lcham mavjud →", { count: vs.length })}</p>
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
              <div className="w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden shrink-0" style={{ background: 'var(--surface2)', color: 'var(--muted3)' }}>
                {open.image_url
                  ? <img src={open.image_url} alt="" className="w-full h-full object-cover" />
                  : <IconBox size={26} />}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold truncate" style={{ color: 'var(--ink)' }}>{open.category || open.name}</h3>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{t("O'lchamni tanlang")}</p>
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
                  <div key={v.id} className="flex items-center gap-3 rounded-xl p-3 border" style={{ background: 'var(--surface2)', borderColor: 'var(--line)' }}>
                    <span className="w-11 h-11 rounded-lg flex items-center justify-center font-bold shrink-0 border" style={{ background: 'var(--surface)', borderColor: 'var(--line2)', color: 'var(--ink)' }}>
                      {v.size_label || '—'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-extrabold tabular-nums" style={{ color: 'var(--lime)' }}>
                        {money(v.cargo_price)}<span className="text-xs font-medium ml-0.5" style={{ color: 'var(--muted3)' }}>so'm/{unit}</span>
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--muted2)' }}>{t('{{count}} {{unit}} mavjud', { count: max, unit })}</p>
                    </div>
                    <div className="shrink-0 w-[120px]">
                      {selected ? (
                        <div className="flex items-center justify-between rounded-xl overflow-hidden" style={{ background: 'var(--royal)' }}>
                          <button onClick={() => dec(open, v, amount)} className="press w-9 h-9 flex items-center justify-center text-white text-xl font-bold">−</button>
                          <span className="text-white text-sm font-bold tabular-nums">{amount}</span>
                          <button onClick={() => inc(open, v, amount)} disabled={amount >= max}
                            className="press w-9 h-9 flex items-center justify-center text-white text-xl font-bold disabled:opacity-40">+</button>
                        </div>
                      ) : (
                        <button onClick={() => select(open, v)} disabled={max <= 0}
                          className="press w-full h-9 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: 'var(--royal)' }}>
                          {t('Tanlash')}
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
            {t('Tasdiqlash')}
            <span className="bg-white/25 px-2.5 py-0.5 rounded-full text-sm">{cartCount}</span>
          </button>
        </div>
      )}
    </div>
  )
}
