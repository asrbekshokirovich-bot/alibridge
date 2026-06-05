import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import type { CartItem } from '@/shared/types'
import { Header, Button, Input, Textarea, IconBox, IconTruck } from '@/shared/ui'

interface LocationState { cart: CartItem[] }

export default function Checkout() {
  const navigate = useNavigate()
  const { state } = useLocation() as { state: LocationState }
  const { notify, haptic } = useTelegram()

  const [pickupType, setPickupType] = useState<'self' | 'courier'>('self')
  const [pickupAddress, setPickupAddress] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const cart = state?.cart ?? []
  const totalWeight = cart.reduce((s, c) => s + c.weight, 0)
  const totalPrice = cart.reduce((s, c) => s + c.price, 0)

  // To'g'ridan-to'g'ri ochilса yoki refresh — savat bo'sh, mahsulotlarga qaytaramiz
  if (cart.length === 0) return <Navigate to="/carrier/products" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pickupType === 'courier' && !pickupAddress) { setError('Manzilni kiriting'); return }
    if (!deliveryAddress) { setError('Turkiyadagi manzilni kiriting'); return }
    setLoading(true); setError('')
    try {
      await client.post('/carrier/orders', {
        items: cart.map((c) => ({ product_id: c.product.id, amount: c.amount })),
        pickup_type: pickupType,
        pickup_address: pickupType === 'courier' ? pickupAddress : null,
        delivery_address_tr: deliveryAddress,
      })
      notify('success')
      navigate('/carrier/my-orders')
    } catch (err) { setError(extractErrorMessage(err)); notify('error') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen pb-32 animate-fade-in">
      <Header title="Tasdiqlash" subtitle={`${cart.length} ta · ${totalWeight.toFixed(1)} kg`} showBack />

      <form onSubmit={handleSubmit} className="px-4 pt-5 space-y-6">
        {/* Yuk ro'yxati */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
          {cart.map((c) => (
            <div key={c.product.id} className="flex items-center gap-3 p-3.5">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-lg shrink-0">
                {c.product.type === 'weight' ? '🧵' : '📦'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-slate-900 truncate">{c.product.name}</p>
                <p className="text-xs text-slate-400">
                  {c.amount} {c.product.type === 'weight' ? 'kg' : 'dona'}
                  {c.product.type === 'piece' && ` · ~${c.weight.toFixed(1)} kg`}
                </p>
              </div>
              <p className="text-sm font-bold text-slate-700">{c.price.toLocaleString()}</p>
            </div>
          ))}
          {/* Jami */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50/50">
            <span className="text-sm font-bold text-slate-700">Jami</span>
            <span className="text-sm font-extrabold" style={{ color: 'var(--brand)' }}>{totalPrice.toLocaleString()} so'm</span>
          </div>
        </div>

        {/* Yuk olish joyi */}
        <div>
          <p className="font-bold text-slate-900 text-[15px] mb-3">Yukni qabul qilish joyi</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { key: 'self' as const, icon: <IconBox size={22} />, title: 'Ombordan', desc: 'O\'zim olaman' },
              { key: 'courier' as const, icon: <IconTruck size={22} />, title: 'Kuryer', desc: 'Olib kelsin' },
            ]).map((opt) => {
              const active = pickupType === opt.key
              return (
                <button key={opt.key} type="button"
                  onClick={() => { haptic('light'); setPickupType(opt.key) }}
                  className={`press rounded-2xl p-4 border-2 text-left transition-colors ${active ? 'border-red-400 bg-red-50/50' : 'border-slate-100 bg-white'}`}>
                  <div className={active ? '' : 'text-slate-400'} style={active ? { color: 'var(--brand)' } : undefined}>{opt.icon}</div>
                  <p className="font-bold text-sm text-slate-900 mt-2">{opt.title}</p>
                  <p className="text-xs text-slate-400">{opt.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        {pickupType === 'courier' && (
          <div className="animate-fade-in">
            <Input label="Toshkentdagi manzilingiz" placeholder="Tuman, ko'cha, uy"
              value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} />
          </div>
        )}

        <Textarea label="Turkiyadagi yetkazish manzili" placeholder="To'liq manzilni yozing"
          value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} rows={3} />

        {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl">{error}</div>}
      </form>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100">
        <Button fullWidth loading={loading} onClick={handleSubmit}>Yuborish</Button>
      </div>
    </div>
  )
}
