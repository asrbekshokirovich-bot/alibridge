import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { useCarrierStore } from '../store'
import type { CartItem } from '@/shared/types'
import { money } from '@/shared/lib/format'
import { isPiece, unitWord } from '@/shared/lib/product'
import { Header, Button, Input, Textarea, IconBox, IconTruck } from '@/shared/ui'

interface LocationState { cart: CartItem[] }

export default function Checkout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { state } = useLocation() as { state: LocationState }
  const { notify, haptic } = useTelegram()
  const { ticket, clearTicket } = useCarrierStore()

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
    if (pickupType === 'courier' && !pickupAddress) { setError(t('Manzilni kiriting')); return }
    if (!deliveryAddress) { setError(t('Turkiyadagi manzilni kiriting')); return }
    setLoading(true); setError('')
    try {
      await client.post('/carrier/orders', {
        items: cart.map((c) => ({ product_id: c.product.id, variant_id: c.variant.id, amount: c.amount })),
        pickup_type: pickupType,
        pickup_address: pickupType === 'courier' ? pickupAddress : null,
        delivery_address_tr: deliveryAddress,
        flight_date: ticket?.flight_date ?? null,
        flight_number: ticket?.flight_number ?? null,
      })
      notify('success')
      clearTicket()
      navigate('/carrier/my-orders')
    } catch (err) { setError(extractErrorMessage(err)); notify('error') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen pb-32 animate-fade-in">
      <Header title={t('Tasdiqlash')} subtitle={t('{{count}} ta · {{weight}} kg', { count: cart.length, weight: totalWeight.toFixed(1) })} showBack />

      <form onSubmit={handleSubmit} className="px-4 pt-5 space-y-6">
        {/* Yuk ro'yxati */}
        <div className="rounded-2xl border divide-y" style={{ background: 'var(--card-gradient)', borderColor: 'var(--line2)', boxShadow: 'var(--shadow-md)' }}>
          {cart.map((c) => (
            <div key={c.variant.id} className="flex items-center gap-3 p-3.5" style={{ borderColor: 'var(--line)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--surface2)', color: 'var(--muted3)' }}>
                <IconBox size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: 'var(--ink)' }}>
                  {c.product.category || c.product.name}
                  {c.variant.size_label && <span className="font-normal" style={{ color: 'var(--muted3)' }}> · {c.variant.size_label}</span>}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {c.amount} {unitWord(c.product.type)}
                  {isPiece(c.product.type) && ` · ~${c.weight.toFixed(1)} kg`}
                </p>
              </div>
              <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{money(c.price)}</p>
            </div>
          ))}
          {/* Jami */}
          <div className="flex items-center justify-between p-3.5" style={{ background: 'var(--surface2)', borderColor: 'var(--line)' }}>
            <span className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{t('Jami')}</span>
            <span className="text-glow-lime text-[17px] font-extrabold tabular-nums" style={{ color: 'var(--lime)' }}>{money(totalPrice)} <span className="text-xs font-semibold" style={{ color: 'var(--muted3)' }}>so'm</span></span>
          </div>
        </div>

        {/* Yuk olish joyi */}
        <div>
          <p className="font-bold text-[15px] mb-3" style={{ color: 'var(--ink)' }}>{t('Yukni qabul qilish joyi')}</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { key: 'self' as const, icon: <IconBox size={22} />, title: t('Ombordan'), desc: t('O\'zim olaman') },
              { key: 'courier' as const, icon: <IconTruck size={22} />, title: t('Kuryer'), desc: t('Olib kelsin') },
            ]).map((opt) => {
              const active = pickupType === opt.key
              return (
                <button key={opt.key} type="button"
                  onClick={() => { haptic('light'); setPickupType(opt.key) }}
                  className="press rounded-2xl p-4 border text-left transition-all"
                  style={{
                    background: active ? 'rgba(106,163,255,0.14)' : 'var(--card-gradient)',
                    borderColor: active ? 'var(--brand-light)' : 'var(--line2)',
                    boxShadow: active ? 'var(--glow-royal)' : 'var(--shadow-md)',
                  }}>
                  <div style={{ color: active ? 'var(--brand-light)' : 'var(--muted3)' }}>{opt.icon}</div>
                  <p className="font-bold text-sm mt-2" style={{ color: 'var(--ink)' }}>{opt.title}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{opt.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        {pickupType === 'courier' && (
          <div className="animate-fade-in">
            <Input label={t('Toshkentdagi manzilingiz')} placeholder={t('Tuman, ko\'cha, uy')}
              value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} />
          </div>
        )}

        <Textarea label={t('Turkiyada yukni qoldirish manzili')}
          placeholder={t('Kuryer kelib oladigan joy (mehmonxona, manzil...)')}
          value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} rows={3} />
        <p className="text-xs -mt-3" style={{ color: 'var(--muted)' }}>
          {t('Yukni shu manzilga qoldirasiz — Turkiyadagi kuryer o\'sha yerdan olib ketadi.')}
        </p>

        {error && <div className="text-sm px-4 py-3 rounded-2xl" style={{ background: 'rgba(239,68,68,0.10)', color: 'var(--red)' }}>{error}</div>}
      </form>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 border-t" style={{ background: 'rgba(10,16,32,0.85)', backdropFilter: 'blur(20px)', borderColor: 'var(--line)' }}>
        <Button fullWidth loading={loading} onClick={handleSubmit}>{t('Yuborish')}</Button>
      </div>
    </div>
  )
}
