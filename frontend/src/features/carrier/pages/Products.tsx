import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import client from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import type { Product, CartItem } from '@/shared/types'
import { money } from '@/shared/lib/format'
import { isPiece, typeEmoji, unitWord } from '@/shared/lib/product'
import { Header, ListSkeleton, EmptyState, Input, Sheet, Button, IconCheck } from '@/shared/ui'

// Donali uchun og'irlik = dona × 1 dona vazni
// Kiloli/tekstil uchun og'irlik = kiritilgan kg
function calcWeight(p: Product, amount: number): number {
  return isPiece(p.type) ? amount * (p.unit_weight_kg ?? 0) : amount
}
// Donali: dona × dona narxi | Kiloli: kg × kg narxi
function calcPrice(p: Product, amount: number): number {
  return amount * p.cargo_price
}

export default function Products() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const [cart, setCart] = useState<CartItem[]>([])

  // Sheet (miqdor kiritish)
  const [sheetProduct, setSheetProduct] = useState<Product | null>(null)
  const [amountInput, setAmountInput] = useState('')

  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => client.get<Product[]>('/products/catalog').then((r) => r.data),
  })

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
    const maxAvailable = isPiece(sheetProduct.type) ? sheetProduct.quantity : sheetProduct.weight_kg
    if (amount > maxAvailable) {
      haptic('heavy')
      alert(`⚠️ Faqat ${maxAvailable} ${unitWord(sheetProduct.type)} mavjud`)
      return
    }

    const item: CartItem = {
      product: sheetProduct,
      amount,
      weight: calcWeight(sheetProduct, amount),
      price: calcPrice(sheetProduct, amount),
    }
    setCart([...cart, item])
    haptic('medium')
    setSheetProduct(null)
  }

  return (
    <div className="min-h-screen pb-28 animate-fade-in">
      <Header title="Mahsulotlar" subtitle="O'zingizga mos yukni tanlang" />

      {/* Ro'yxat */}
      {isLoading ? (
        <ListSkeleton />
      ) : !products?.length ? (
        <EmptyState title="Mahsulot topilmadi" description="Hozircha mahsulot yo'q" />
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
                    : <span className="text-2xl">{typeEmoji(p.type)}</span>}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-[15px] truncate">{p.name}</h3>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${isPiece(p.type) ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                      {unitWord(p.type).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{p.category}</p>

                  {selected ? (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold text-white px-2 py-0.5 rounded-lg" style={{ background: 'var(--brand-gradient)' }}>
                        {item!.amount} {unitWord(p.type)} tanlandi
                      </span>
                      <span className="text-xs font-semibold text-slate-500">{money(item!.price)}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                        {isPiece(p.type) ? `${p.quantity} dona mavjud` : `${p.weight_kg} kg mavjud`}
                      </span>
                      <span className="text-sm font-bold" style={{ color: 'var(--brand)' }}>
                        {money(p.cargo_price)}/{unitWord(p.type)}
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

      {/* Suzuvchi tasdiqlash — sana kiritish ekraniga o'tadi */}
      {cart.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-[480px] px-4 z-20 animate-slide-up">
          <button onClick={() => { haptic('medium'); navigate('/carrier/ticket', { state: { cart } }) }}
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
                {typeEmoji(sheetProduct.type)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 truncate">{sheetProduct.name}</h3>
                <p className="text-xs text-slate-400">{sheetProduct.category}</p>
              </div>
            </div>

            {/* Kg bo'yicha (kiloli/tekstil) uchun tushuntirish */}
            {!isPiece(sheetProduct.type) && (
              <div className="rounded-2xl p-3 mb-4 flex gap-2.5" style={{ background: 'var(--brand-gradient-soft)' }}>
                <span className="text-base">ℹ️</span>
                <p className="text-[12px] text-red-900/70 leading-snug">
                  Necha kg kerakligini kiriting. Ombor xodimi tortib aniq dona sonini belgilaydi.
                </p>
              </div>
            )}

            <Input
              type="number"
              label={isPiece(sheetProduct.type) ? 'Necha dona kerak?' : 'Necha kg kerak?'}
              placeholder={isPiece(sheetProduct.type) ? `Maks: ${sheetProduct.quantity} dona` : `Maks: ${sheetProduct.weight_kg} kg`}
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
                    {isPiece(sheetProduct.type) && <span className="text-xs text-slate-400 font-normal"> (taxminiy)</span>}
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
