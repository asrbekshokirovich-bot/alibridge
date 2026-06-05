import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { useCarrierStore } from '../store'
import { Header, Button, Input, IconPlane } from '@/shared/ui'

export default function TicketForm() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { ticket, setTicket } = useCarrierStore()
  const isEdit = !!ticket

  const [form, setForm] = useState({
    flight_number: ticket?.flight_number ?? '',
    flight_date: ticket?.flight_date ?? '',
    weight_limit: ticket?.weight_limit ? String(ticket.weight_limit) : '',
  })

  const handleSubmit = () => {
    haptic('medium')
    setTicket({
      flight_number: form.flight_number,
      flight_date: form.flight_date,
      weight_limit: parseFloat(form.weight_limit),
    })
    navigate('/carrier/products')
  }

  const today = new Date().toISOString().split('T')[0]
  const dateValid = form.flight_date >= today
  const valid = form.flight_number && form.flight_date && dateValid && parseFloat(form.weight_limit) > 0

  return (
    <div className="min-h-screen animate-fade-in">
      <Header title={isEdit ? "Biletni yangilash" : "Bilet ma'lumotlari"}
        showBack={isEdit} onBack={() => navigate('/carrier/products')} />

      <div className="px-5 pt-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-white mb-3 shadow-[var(--shadow-brand)]" style={{ background: 'var(--brand-gradient)' }}>
            <IconPlane size={30} />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Reys ma'lumotlari</h2>
          <p className="text-sm text-slate-500 text-center mt-1">
            {isEdit ? 'Yangi safar uchun yangilang' : 'Mahsulot tanlashdan oldin to\'ldiring'}
          </p>
        </div>

        <div className="space-y-4">
          <Input label="Reys raqami" placeholder="Masalan: HY-273"
            value={form.flight_number} onChange={(e) => setForm({ ...form, flight_number: e.target.value })} />

          <div>
            <Input type="date" label="Uchish sanasi" min={today}
              value={form.flight_date} onChange={(e) => setForm({ ...form, flight_date: e.target.value })} />
            {form.flight_date && !dateValid && (
              <p className="text-xs text-red-500 mt-1.5">Sana o'tmishda bo'lishi mumkin emas</p>
            )}
          </div>

          <Input type="number" label="Olib keta oladigan vazn (kg)" placeholder="Masalan: 20"
            value={form.weight_limit} onChange={(e) => setForm({ ...form, weight_limit: e.target.value })} />
        </div>

        <Button fullWidth className="mt-6" disabled={!valid} onClick={handleSubmit}>
          {isEdit ? 'Yangilash' : 'Davom etish'}
        </Button>
      </div>
    </div>
  )
}
