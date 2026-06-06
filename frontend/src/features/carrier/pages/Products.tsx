import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import client from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { useCarrierStore } from '../store'
import type { Product, CartItem } from '@/shared/types'
import { money } from '@/shared/lib/format'
import { Header, ListSkeleton, EmptyState, Input, Sheet, Button, IconCheck, IconPlane } from '@/shared/ui'

// Donali uchun og'irlik = dona × 1 dona vazni
// Kiloli uchun og'irlik = kiritilgan kg
function calcWeight(p: Product, amount: number): number {
  return p.type === 'piece' ? amount * (p.unit_weight_kg ?? 0) : amount
}
// Donali: dona × dona narxi | Kiloli: kg × kg narxi
function calcPrice(p: Product, amount: number): number {
  return amount * p.cargo_price
}

export default function Products() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const ticket = useCarrierStore((s) => s.ticket)
  const [cart, setCart] = useState<CartItem[]>([])

  // Sheet (miqdor kiritish)
  const [sheetProduct, setSheetProduct] = useState<Product | null>(null)
  const [amountInput, setAmountInput] = useState('')

  const limit = ticket?.weight_limit ?? 0
  const totalWeight = cart.reduce((s, c) => s + c.weight, 0)
  const pct = limit ? Math.min((totalWeight / limit) * 100, 100) : 0

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', limit],
    queryFn: () => client.get<Product[]>('/products/catalog', {
      params: { max_weight: limit || undefined },
    }).then((r) => r.data),
    enabled: !!ticket,
  })

  // Bilet yo'q bo'lsa — avval bilet kiritsin
  if (!ticket) return <Navigate to="/carrier/ticket" replace />

  const inCart = (id: number) => cart.find((c) => c.product.id === id)

  const openSheet = (p: Product) => {
    const existing = inCart(p.id)
    if (existing) {
      // Savatdan olib tashlash
      setCart(cart.filter((c) => c.product.id !== p.id))
      haptic('light')
      return
    }
    haptic('light')
    setSheetProduct(p)
    setAmountInput('')
  }

  const confirmAmount = () => {
    if (!sheetProduct) return
    const amount = parseFloat(amountInput)
    if (!amount || amount <= 0) return

    // Mavjud miqdordan oshmasligi
    const maxAvailable = sheetProduct.type === 'piece' ? sheetProduct.quantity : sheetProduct.weight_kg
    if (amount > maxAvailable) {
      haptic('heavy')
      alert(`⚠️ Faqat ${maxAvailable} ${sheetProduct.type === 'piece' ? 'dona' : 'kg'} mavjud`)
      return
    }

    const weight = calcWeight(sheetProduct, amount)

    // Limit tekshirish
    if (limit && totalWeight + weight > limit) {
      haptic('heavy')
      alert(`⚠️ Limit oshib ketdi! Bu ${weight.toFixed(1)} kg, sizda ${(limit - totalWeight).toFixed(1)} kg joy bor`)
      return
    }

    const item: CartItem = {
      product: sheetProduct,
      amount,
      weight,
      price: calcPrice(sheetProduct, amount),
    }
    setCart([...cart, item])
    haptic('medium')
    setSheetProduct(null)
  }

  return (
    <div className="min-h-screen pb-28 animate-fade-in">
      <Header title="Mahsulotlar" subtitle="O'zingizga mos yukni tanlang" />

      {/* Bilet banner */}
      <div className="px-4 pt-4">
        <button onClick={() => { haptic('light'); navigate('/carrier/ticket') }}
          className="press w-full rounded-2xl p-3.5 flex items-center gap-3 text-white text-left" style={{ background: 'var(--brand-gradient)' }}>
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <IconPlane size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{ticket.flight_number} · {ticket.flight_date}</p>
            <p className="text-xs text-white/80">Limit: {limit} kg · bosib yangilang</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-white/70 shrink-0">
            <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Progress */}
      {cart.length > 0 && (
        <div className="px-4 pt-3 animate-fade-in">
          <div className="flex justify-between text-xs font-medium text-slate-600 mb-1.5">
            <span>Yuklangan</span>
            <span>{totalWeight.toFixed(1)} / {limit} kg</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, background: pct > 90 ? '#f59e0b' : 'var(--brand-gradient)' }} />
          </div>
        </div>
      )}

      {/* Ro'yxat */}
      {isLoading ? (
        <ListSkeleton />
      ) : !products?.length ? (
        <EmptyState title="Mahsulot topilmadi" description="Bu vaznga mos mahsulot yo'q" />
      ) : (
        <div className="px-4 pt-4 space-y-3">
          {products.map((p) => {
            const item = inCart(p.id)
            const selected = !!item
            return (
              <button key={p.id} onClick={() => openSheet(p)}
                className={`press w-full bg-white rounded-2xl p-3.5 border-2 flex items-center gap-3.5 text-left transition-colors ${selected ? 'border-red-400' : 'border-slate-100'}`}>
                <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                  {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    : <span className="text-2xl">{p.type === 'weight' ? '🧵' : '📦'}</span>}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-[15px] truncate">{p.name}</h3>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${p.type === 'weight' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                      {p.type === 'weight' ? 'KG' : 'DONA'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{p.category}</p>

                  {selected ? (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold text-white px-2 py-0.5 rounded-lg" style={{ background: 'var(--brand-gradient)' }}>
                        {item!.amount} {p.type === 'weight' ? 'kg' : 'dona'} tanlandi
                      </span>
                      <span className="text-xs font-semibold text-slate-500">{money(item!.price)}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                        {p.type === 'weight' ? `${p.weight_kg} kg mavjud` : `${p.quantity} dona mavjud`}
                      </span>
                      <span className="text-sm font-bold" style={{ color: 'var(--brand)' }}>
                        {money(p.cargo_price)}/{p.type === 'weight' ? 'kg' : 'dona'}
                      </span>
                    </div>
                  )}
                </div>

                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all ${selected ? 'text-white' : 'border-2 border-slate-200 text-slate-300'}`}
                  style={selected ? { background: 'var(--brand-gradient)' } : undefined}>
                  {selected ? <IconCheck size={16} /> : <span className="text-lg leading-none">+</span>}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Suzuvchi tasdiqlash */}
      {cart.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-[480px] px-4 z-20 animate-slide-up">
          <button onClick={() => { haptic('medium'); navigate('/carrier/checkout', { state: { cart } }) }}
            style={{ background: 'var(--brand-gradient)' }}
            className="press w-full text-white rounded-2xl py-4 font-bold shadow-[var(--shadow-brand)] flex items-center justify-center gap-2">
            Tasdiqlash
            <span className="bg-white/25 px-2.5 py-0.5 rounded-full text-sm">{cart.length}</span>
          </button>
        </div>
      )}

      {/* Miqdor kiritish sheet */}
      <Sheet open={!!sheetProduct} onClose={() => setSheetProduct(null)}>
        {sheetProduct && (
          <div className="px-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-2xl shrink-0">
                {sheetProduct.type === 'weight' ? '🧵' : '📦'}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 truncate">{sheetProduct.name}</h3>
                <p className="text-xs text-slate-400">{sheetProduct.category}</p>
              </div>
            </div>

            {/* Kiloli uchun tushuntirish */}
            {sheetProduct.type === 'weight' && (
              <div className="rounded-2xl p-3 mb-4 flex gap-2.5" style={{ background: 'var(--brand-gradient-soft)' }}>
                <span className="text-base">ℹ️</span>
                <p className="text-[12px] text-red-900/70 leading-snug">
                  Necha kg kerakligini kiriting. Ombor xodimi tortib aniq dona sonini belgilaydi.
                </p>
              </div>
            )}

            <Input
              type="number"
              label={sheetProduct.type === 'weight' ? 'Necha kg kerak?' : 'Necha dona kerak?'}
              placeholder={sheetProduct.type === 'weight' ? `Maks: ${sheetProduct.weight_kg} kg` : `Maks: ${sheetProduct.quantity} dona`}
              className="text-center text-lg font-bold"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              autoFocus
            />

            {/* Hisob-kitob ko'rsatkichi */}
            {amountInput && parseFloat(amountInput) > 0 && (
              <div className="mt-3 bg-slate-50 rounded-2xl p-3.5 space-y-2 animate-fade-in">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Og'irlik</span>
                  <span className="font-bold text-slate-900">
                    {calcWeight(sheetProduct, parseFloat(amountInput)).toFixed(1)} kg
                    {sheetProduct.type === 'piece' && <span className="text-xs text-slate-400 font-normal"> (taxminiy)</span>}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Narx</span>
                  <span className="font-bold" style={{ color: 'var(--brand)' }}>
                    {money(calcPrice(sheetProduct, parseFloat(amountInput)))}
                  </span>
                </div>
              </div>
            )}

            <Button fullWidth className="mt-4" onClick={confirmAmount}
              disabled={!amountInput || parseFloat(amountInput) <= 0}>
              Savatga qo'shish
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  )
}
