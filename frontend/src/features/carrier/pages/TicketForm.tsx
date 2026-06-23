import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { useCarrierStore } from '../store'
import type { CartItem } from '@/shared/types'
import { Header, Button, Input, IconPlane } from '@/shared/ui'

interface LocationState { cart: CartItem[] }

export default function TicketForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { state } = useLocation() as { state: LocationState }
  const { haptic } = useTelegram()
  const { setTicket } = useCarrierStore()

  const cart = state?.cart ?? []
  const [flightDate, setFlightDate] = useState('')
  const [flightNumber, setFlightNumber] = useState('')

  // Savatsiz ochilsa — mahsulotlarga qaytaramiz
  if (cart.length === 0) return <Navigate to="/carrier/products" replace />

  const today = new Date().toISOString().split('T')[0]
  const dateValid = flightDate >= today
  const valid = !!flightDate && dateValid

  const handleSubmit = () => {
    haptic('medium')
    setTicket({ flight_date: flightDate, flight_number: flightNumber.trim() || undefined })
    navigate('/carrier/checkout', { state: { cart } })
  }

  return (
    <div className="min-h-screen animate-fade-in">
      <Header title={t('Uchish sanasi')} showBack onBack={() => navigate('/carrier/products')} />

      <div className="px-5 pt-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-white mb-3 shadow-[var(--shadow-brand)]" style={{ background: 'var(--brand-gradient)' }}>
            <IconPlane size={30} />
          </div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('Qachon uchasiz?')}</h2>
          <p className="text-sm text-center mt-1" style={{ color: 'var(--muted)' }}>{t('Uchish sanangizni kiriting')}</p>
        </div>

        <div>
          <Input type="date" label={t('Uchish sanasi')} min={today}
            value={flightDate} onChange={(e) => setFlightDate(e.target.value)} />
          {flightDate && !dateValid && (
            <p className="text-xs mt-1.5" style={{ color: 'var(--red)' }}>{t("Sana o'tmishda bo'lishi mumkin emas")}</p>
          )}
        </div>

        <div className="mt-4">
          <Input label={t('Reys raqami')} placeholder={t('Masalan: HY601')}
            value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)}
            maxLength={32} />
          <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>{t('Ixtiyoriy')}</p>
        </div>

        <Button fullWidth className="mt-6" disabled={!valid} onClick={handleSubmit}>
          {t('Davom etish')}
        </Button>
      </div>
    </div>
  )
}
