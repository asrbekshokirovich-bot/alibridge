import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import client from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { useAuthStore } from '@/shared/store/auth'
import { useCarrierStore } from '../store'
import type { Product, ProductVariant, CartItem } from '@/shared/types'
import { money, initials } from '@/shared/lib/format'
import { isPiece, productGroup, typeLabel, unitWord, type ProductGroup } from '@/shared/lib/product'
import { Sheet, IconBox, IconPlane, IconChevronRight } from '@/shared/ui'

// Yo'lovchi reysiga ishonch limiti (kg). Hozircha qat'iy — keyin profildan keladi.
const WEIGHT_LIMIT_KG = 20

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

type Filter = 'all' | ProductGroup

export default function Products() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const user = useAuthStore((s) => s.user)
  const ticket = useCarrierStore((s) => s.ticket)
  const [cart, setCart] = useState<CartItem[]>([])
  const [open, setOpen] = useState<Product | null>(null)
  const [filter, setFilter] = useState<Filter>('all')

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
  const totalWeight = cart.reduce((s, c) => s + c.weight, 0)
  const totalPrice = cart.reduce((s, c) => s + c.price, 0)
  const weightPct = Math.min(100, (totalWeight / WEIGHT_LIMIT_KG) * 100)
  const overLimit = totalWeight > WEIGHT_LIMIT_KG

  // Kartada ko'rsatiladigan narx oralig'i
  const priceRange = (p: Product) => {
    const vs = realVariants(p)
    const prices = vs.map((v) => v.cargo_price).filter((x) => x > 0)
    if (!prices.length) return null
    const min = Math.min(...prices), max = Math.max(...prices)
    return min === max ? money(min) : `${money(min)}–${money(max)}`
  }

  // Ochiq mahsulot bo'yicha tanlangan jami (sheet footer uchun)
  const openSelected = open
    ? cart.filter((c) => c.product.id === open.id).reduce(
        (a, c) => ({ amount: a.amount + c.amount, weight: a.weight + c.weight, price: a.price + c.price }),
        { amount: 0, weight: 0, price: 0 },
      )
    : null

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: t('Hammasi') },
    { key: 'piece', label: t('Donali') },
    { key: 'boxed', label: t('Kiloli') },
    { key: 'textile', label: t('Tekstil') },
  ]

  const visible = (products ?? []).filter((p) => realVariants(p).length > 0 && (filter === 'all' || productGroup(p.type) === filter))
  const flightLabel = [ticket?.flight_date, ticket?.flight_number].filter(Boolean).join(' · ')

  return (
    <div className="min-h-screen pb-32 animate-fade-in">
      {/* App bar — sarlavha + reys + yo'lovchi raqami */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3">
        <div className="min-w-0">
          <h1 className="text-[23px] font-extrabold tracking-[-0.02em] truncate" style={{ color: 'var(--text)' }}>
            {t('Yuk katalogi')}
          </h1>
          {flightLabel && (
            <div className="flex items-center gap-1.5 mt-1" style={{ color: 'var(--text-muted)' }}>
              <IconPlane size={13} />
              <span className="text-[12.5px] truncate">{t('Reys')} {flightLabel}</span>
            </div>
          )}
        </div>
        {user?.carrier_number != null && (
          <div className="flex items-center gap-1.5 rounded-full pl-3 pr-1.5 py-1 shrink-0 border"
            style={{ background: 'var(--card-2)', borderColor: 'var(--border-chip)' }}>
            <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>#{user.carrier_number}</span>
            <div className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-xs font-extrabold"
              style={{ background: 'linear-gradient(150deg,#3a3a44,#1d1d22)', color: 'var(--text)' }}>
              {initials(user?.first_name, user?.last_name)}
            </div>
          </div>
        )}
      </div>

      {/* Og'irlik limiti + daromad kartasi */}
      <div className="mx-4 rounded-[22px] border p-[17px]"
        style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-md)' }}>
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-[12.5px] font-semibold" style={{ color: 'var(--text-muted)' }}>{t('Yuk hajmi')}</span>
          <span className="text-sm font-bold tabnum" style={{ color: 'var(--text)' }}>
            <span style={{ color: overLimit ? 'var(--brand)' : 'var(--brand-light)' }}>{totalWeight.toFixed(1)}</span> / {WEIGHT_LIMIT_KG} kg
          </span>
        </div>
        <div className="h-2 rounded-md overflow-hidden" style={{ background: 'var(--border-chip)' }}>
          <div className="h-full rounded-md transition-all"
            style={{ width: `${weightPct}%`, background: 'linear-gradient(90deg,#e0334a,#ff5c6a)', boxShadow: '0 0 12px rgba(255,92,106,0.5)' }} />
        </div>
        <div className="flex items-center justify-between mt-[15px] pt-[14px] border-t" style={{ borderColor: 'var(--border-soft)' }}>
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('Taxminiy daromad')}</p>
            <p className="mt-1 text-2xl font-extrabold tracking-[-0.02em] tabnum text-earn">{money(totalPrice)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('Tanlangan')}</p>
            <p className="mt-1 text-2xl font-extrabold tabnum" style={{ color: 'var(--text)' }}>
              {cartCount} <span className="text-[13px] font-semibold" style={{ color: 'var(--text-faint)' }}>{t('ta')}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Filtr chiplari */}
      <div className="flex gap-2 px-4 pt-4 pb-3 overflow-x-auto no-scrollbar">
        {filters.map((f) => {
          const active = filter === f.key
          return (
            <button key={f.key} onClick={() => { haptic('light'); setFilter(f.key) }}
              className="shrink-0 text-[13px] font-bold px-4 py-2 rounded-full border transition-colors"
              style={active
                ? { background: 'var(--text)', color: 'var(--bg)', borderColor: 'var(--text)' }
                : { background: 'var(--card-2)', color: 'var(--text-2)', borderColor: 'var(--border-chip)' }}>
              {f.label}
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <div className="px-4 pt-1 grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton rounded-[18px]" style={{ aspectRatio: '1 / 1.5' }} />)}
        </div>
      ) : !visible.length ? (
        <p className="text-center text-sm py-16" style={{ color: 'var(--text-muted)' }}>{t('Mahsulot topilmadi')}</p>
      ) : (
        <div className="px-3.5 grid grid-cols-2 gap-3 web-grid web-grid-catalog">
          {visible.map((p) => {
            const vs = realVariants(p)
            const selectedCount = productCartCount(p)
            const selected = selectedCount > 0
            const unit = unitWord(p.type)
            const pr = priceRange(p)
            return (
              <button key={p.id} onClick={() => { haptic('light'); setOpen(p) }}
                className="text-left rounded-[18px] overflow-hidden border flex flex-col transition-colors"
                style={selected
                  ? { background: 'var(--card)', borderColor: 'var(--brand-tint-border)', borderWidth: 1.5, boxShadow: '0 0 0 3px rgba(255,92,106,0.1)' }
                  : { background: 'var(--card)', borderColor: 'var(--border)' }}>
                {/* Rasm */}
                <div className="flex items-center justify-center overflow-hidden relative border-b"
                  style={{ aspectRatio: '1 / 0.86', background: 'linear-gradient(135deg,#1b1b20,#101013)', borderColor: 'var(--border-soft)' }}>
                  {p.image_url
                    ? <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                    : <span style={{ color: 'var(--text-ghost)' }}><IconBox size={34} /></span>}
                  <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-[3px] rounded-md backdrop-blur-md"
                    style={{ color: 'var(--text-2)', background: 'rgba(0,0,0,0.4)' }}>{typeLabel(p.type)}</span>
                  {selected && (
                    <span className="absolute top-2 right-2 min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-extrabold flex items-center justify-center"
                      style={{ background: 'var(--brand)', color: 'var(--bg)' }}>{selectedCount}</span>
                  )}
                </div>

                <div className="p-3 flex flex-col gap-2 flex-1">
                  <h3 className="text-[14px] font-bold leading-tight line-clamp-2" style={{ color: 'var(--text)' }}>{p.category || p.name}</h3>
                  {pr && (
                    <div className="text-[15px] font-extrabold leading-tight tabnum" style={{ color: 'var(--text)' }}>
                      {pr}<span className="text-[11px] font-semibold" style={{ color: 'var(--text-dim)' }}> /{unit}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 mt-auto">
                    <span className="text-[10.5px] font-semibold px-[7px] py-[3px] rounded-md"
                      style={{ background: 'var(--card-3)', color: 'var(--text-muted)' }}>
                      {isPiece(p.type) && p.unit_weight_kg ? `${p.unit_weight_kg} kg` : (isPiece(p.type) ? t('dona') : t('kg bo\'yicha'))}
                    </span>
                    <span className="text-[10.5px]" style={{ color: 'var(--text-faint)' }}>{t('{{count}} o\'lcham', { count: vs.length })}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* O'lcham & miqdor Sheet (Frame 2) */}
      <Sheet open={!!open} onClose={() => setOpen(null)}>
        {open && (
          <div className="px-[18px] pt-1 pb-1">
            {/* Mahsulot sarlavhasi */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-[58px] h-[58px] rounded-2xl flex items-center justify-center overflow-hidden shrink-0 border"
                style={{ background: 'linear-gradient(135deg,#1f1f25,#141417)', borderColor: 'var(--border-strong)' }}>
                {open.image_url
                  ? <img src={open.image_url} alt="" className="w-full h-full object-cover" />
                  : <span style={{ color: 'var(--text-faint)' }}><IconBox size={28} /></span>}
              </div>
              <div className="min-w-0">
                <p className="text-[18px] font-extrabold tracking-[-0.01em] truncate" style={{ color: 'var(--text)' }}>{open.category || open.name}</p>
                <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  {t("O'lcham va miqdorni tanlang")}
                  {isPiece(open.type) && open.unit_weight_kg ? ` · ${t('har dona')} ${open.unit_weight_kg} kg` : ''}
                </p>
              </div>
            </div>

            {/* O'lcham qatorlari */}
            <div className="flex flex-col gap-2.5 max-h-[46vh] overflow-y-auto no-scrollbar">
              {realVariants(open).map((v) => {
                const item = inCart(v.id)
                const amount = item?.amount ?? 0
                const selected = amount > 0
                const unit = unitWord(open.type)
                const max = maxAmount(open, v)
                return (
                  <div key={v.id} className="flex items-center gap-3 rounded-2xl p-3 border"
                    style={selected
                      ? { background: 'var(--card-2)', borderColor: 'var(--border-strong)' }
                      : { background: 'var(--card)', borderColor: 'var(--border)' }}>
                    <span className="w-[46px] h-[46px] rounded-xl flex items-center justify-center text-base font-extrabold shrink-0 border"
                      style={{ background: 'var(--bg)', borderColor: 'var(--border-strong)', color: 'var(--text)' }}>
                      {v.size_label || '—'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-extrabold tabnum" style={{ color: 'var(--text)' }}>
                        {money(v.cargo_price)}<span className="text-[11px] font-semibold" style={{ color: 'var(--text-dim)' }}>/{unit}</span>
                      </p>
                      <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-faint)' }}>{t('{{count}} {{unit}} mavjud', { count: max, unit })}</p>
                    </div>
                    <div className="shrink-0">
                      {selected ? (
                        <div className="flex items-center rounded-[13px] overflow-hidden" style={{ background: 'var(--brand-gradient)', boxShadow: '0 6px 16px -6px rgba(255,77,94,0.6)' }}>
                          <button onClick={() => dec(open, v, amount)} className="press w-[38px] h-[38px] flex items-center justify-center text-white text-xl font-bold">−</button>
                          <span className="text-white text-[15px] font-extrabold tabnum min-w-[22px] text-center">{amount}</span>
                          <button onClick={() => inc(open, v, amount)} disabled={amount >= max}
                            className="press w-[38px] h-[38px] flex items-center justify-center text-white text-xl font-bold disabled:opacity-40">+</button>
                        </div>
                      ) : (
                        <button onClick={() => select(open, v)} disabled={max <= 0}
                          className="press text-[13px] font-bold px-[18px] py-2.5 rounded-[13px] disabled:opacity-40"
                          style={{ background: 'var(--card-3)', color: 'var(--text)' }}>
                          {t('Tanlash')}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer — shu mahsulot bo'yicha qo'shilgan jami */}
            {openSelected && openSelected.amount > 0 && (
              <div className="flex items-center gap-3.5 mt-5 pt-[18px] border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                    {t('{{count}} {{unit}}', { count: openSelected.amount, unit: unitWord(open.type) })}
                    {isPiece(open.type) && ` · ${openSelected.weight.toFixed(1)} kg`}
                  </p>
                  <p className="text-lg font-extrabold tabnum text-earn mt-0.5">+{money(openSelected.price)}</p>
                </div>
                <button onClick={() => { haptic('medium'); setOpen(null) }}
                  className="press text-[15px] font-extrabold text-white px-7 py-3.5 rounded-2xl"
                  style={{ background: 'var(--brand-gradient)', boxShadow: 'var(--shadow-brand)' }}>
                  {t('Tayyor')}
                </button>
              </div>
            )}
          </div>
        )}
      </Sheet>

      {/* Sticky savat paneli */}
      {cartCount > 0 && (
        <div className="tg-float fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-20 px-3.5 pb-4 pt-5"
          style={{ background: 'linear-gradient(to top, var(--bg) 62%, transparent)' }}>
          <div className="flex items-center gap-3 rounded-[22px] border pl-[17px] pr-[9px] py-[9px] animate-slide-up"
            style={{ background: 'rgba(24,24,28,0.92)', borderColor: 'var(--border-strong)', backdropFilter: 'blur(24px)', boxShadow: '0 18px 44px -12px rgba(0,0,0,0.8)' }}>
            <div className="flex-1 min-w-0">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('{{count}} ta yuk', { count: cartCount })} · {totalWeight.toFixed(1)} kg</p>
              <p className="text-base font-extrabold tabnum text-earn mt-0.5">{money(totalPrice)}</p>
            </div>
            <button onClick={() => { haptic('medium'); navigate('/carrier/ticket', { state: { cart } }) }}
              className="press flex items-center gap-2 text-sm font-extrabold text-white px-5 py-3.5 rounded-2xl"
              style={{ background: 'var(--brand-gradient)', boxShadow: 'var(--shadow-brand)' }}>
              {t('Davom etish')}
              <IconChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
