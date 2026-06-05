import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { Header, Button, Input, ScanSession, IconPlane } from '@/shared/ui'

export default function AirportHandover() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const [carrierNumber, setCarrierNumber] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  // 2-bosqich: skanlash
  if (confirmed) {
    return (
      <ScanSession
        title={`Yo'lovchi #${carrierNumber}`}
        subtitle="Barkodlarni skanlang"
        showBack
        onBack={() => setConfirmed(false)}
        scanUrl="/courier-uz/scan-airport"
        confirmUrl="/courier-uz/confirm-airport"
        scanBody={{ carrier_number: parseInt(carrierNumber) }}
        confirmBody={{ carrier_number: parseInt(carrierNumber) }}
        successTitle="Topshirildi!"
        successDesc={(n) => `Yo'lovchi #${carrierNumber} ga ${n} ta mahsulot o'tdi.`}
      />
    )
  }

  // 1-bosqich: raqam kiritish
  return (
    <div className="min-h-screen animate-fade-in">
      <Header title="Aeroportda topshirish" showBack onBack={() => navigate('/courier-uz')} />

      <div className="px-5 pt-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-white mb-3" style={{ background: 'var(--brand-gradient)' }}>
            <IconPlane size={30} />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Yo'lovchi raqami</h2>
          <p className="text-sm text-slate-500 text-center mt-1">Yo'lovchining tartib raqamini kiriting</p>
        </div>

        <Input type="number" placeholder="Masalan: 47" className="text-center text-lg font-bold"
          value={carrierNumber} onChange={(e) => setCarrierNumber(e.target.value)} />

        <Button fullWidth className="mt-4"
          disabled={!carrierNumber || isNaN(parseInt(carrierNumber, 10)) || parseInt(carrierNumber, 10) <= 0}
          onClick={() => { haptic('medium'); setConfirmed(true) }}>
          Davom etish
        </Button>
      </div>
    </div>
  )
}
