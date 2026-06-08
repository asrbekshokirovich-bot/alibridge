import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { labelUrl } from '@/shared/lib/product'
import { Header, Button, Input } from '@/shared/ui'
import ProductDetailsForm from '../components/ProductDetailsForm'

interface ReceiveResult {
  id: number
  barcode: string
  name: string
  received_date: string
  print_url: string
  quantity: number
}

type Step = 'name' | 'details' | 'done'

export default function ReceiveGoods() {
  const navigate = useNavigate()
  const { notify, openLink } = useTelegram()

  const [step, setStep] = useState<Step>('name')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [created, setCreated] = useState<ReceiveResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 1-qadam: nom -> barkod yaratish
  const createBarcode = async () => {
    if (!name.trim() || loading) return
    setLoading(true)
    setError('')
    try {
      const res = await client.post<ReceiveResult>('/warehouse-uz/receive', {
        name: name.trim(),
        category: category.trim(),
      })
      notify('success')
      setCreated(res.data)
      setStep('details')
    } catch (err) {
      setError(extractErrorMessage(err))
      notify('error')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setStep('name')
    setName('')
    setCategory('')
    setCreated(null)
    setError('')
  }

  // ─── 1-QADAM: nom ──────────────────────────────────────────────────────
  if (step === 'name') {
    return (
      <div className="min-h-screen pb-32 animate-fade-in">
        <Header title="Yuk qabul qilish" subtitle="1-qadam: mahsulot nomi" showBack />
        <div className="px-4 pt-5 space-y-4">
          <Input label="Mahsulot nomi" placeholder="Masalan: Krasovka Nike" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Input label="Kategoriya (ixtiyoriy)" placeholder="Poyabzal, tekstil, elektronika..." value={category} onChange={(e) => setCategory(e.target.value)} />
          <div className="rounded-2xl p-3 flex gap-2.5" style={{ background: 'var(--brand-gradient-soft)' }}>
            <span className="text-base">ℹ️</span>
            <p className="text-[12px] text-red-900/70 leading-snug">
              Avval barkod yaratiladi va chop etiladi. Keyingi oynada yuk turi, soni va narxini kiritasiz.
            </p>
          </div>
          {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl">{error}</div>}
        </div>
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100">
          <Button fullWidth loading={loading} disabled={!name.trim()} onClick={createBarcode}>
            Barkod yaratish
          </Button>
        </div>
      </div>
    )
  }

  // ─── 2-QADAM: barkod + ma'lumotlar formasi ─────────────────────────────
  if (step === 'details' && created) {
    return (
      <div className="min-h-screen pb-32 animate-fade-in">
        <Header title="Yuk qabul qilish" subtitle="2-qadam: ma'lumotlar" showBack />

        {/* Yaratilgan barkod */}
        <div className="px-4 pt-4">
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-4 text-center">
            <p className="text-base font-bold text-slate-900 truncate">{created.name}</p>
            <p className="text-xs text-slate-500 mb-2.5">{created.received_date}</p>
            <div className="flex justify-center items-end gap-[2px] mb-1 h-10">
              {Array.from({ length: 36 }).map((_, i) => (
                <div key={i} className="bg-slate-900" style={{ width: i % 4 === 0 ? 3 : i % 3 === 0 ? 1 : 2, height: '100%' }} />
              ))}
            </div>
            <p className="font-mono text-sm font-bold tracking-widest text-slate-900">{created.barcode}</p>
            <button
              onClick={() => openLink(labelUrl(created.barcode, new Date().toISOString().slice(0, 10)))}
              className="press inline-block mt-2.5 text-sm font-semibold px-4 py-2 rounded-xl text-white" style={{ background: 'var(--brand-gradient)' }}>
              🖨️ Barkod chiqarish
            </button>
          </div>
        </div>

        {/* Ma'lumotlar formasi (PATCH) */}
        <ProductDetailsForm
          productId={created.id}
          submitLabel="Qabul qilish"
          onSaved={() => setStep('done')}
        />
      </div>
    )
  }

  // ─── 3-QADAM: tugadi ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 animate-scale-in">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
        style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 12px 32px rgba(34,197,94,0.4)' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
          <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-1">Yuk qabul qilindi!</h2>
      <p className="text-sm text-slate-500 mb-6">{created?.name} — {created?.barcode}</p>

      <button onClick={reset} className="press w-full text-white rounded-2xl py-4 font-bold" style={{ background: 'var(--brand-gradient)' }}>
        Yangi yuk qabul qilish
      </button>
      <button onClick={() => navigate('/warehouse-uz')} className="press text-slate-400 text-sm font-medium mt-4">
        Bosh sahifaga
      </button>
    </div>
  )
}
