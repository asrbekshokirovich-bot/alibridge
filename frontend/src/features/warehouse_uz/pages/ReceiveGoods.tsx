import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { Header, Button, Input } from '@/shared/ui'

type ProductType = 'piece' | 'weight'

interface ReceiveResult {
  barcode: string
  print_url: string
  quantity: number
}

export default function ReceiveGoods() {
  const navigate = useNavigate()
  const { notify, haptic } = useTelegram()

  const [form, setForm] = useState({
    name: '', category: '', type: 'piece' as ProductType,
    quantity: '', weight_kg: '', box_weight_kg: '', cargo_price: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ReceiveResult | null>(null)
  const isWeight = form.type === 'weight'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await client.post<ReceiveResult>('/warehouse-uz/receive', {
        name: form.name, category: form.category, type: form.type,
        quantity: parseInt(form.quantity, 10),
        weight_kg: isWeight ? parseFloat(form.weight_kg) : null,
        box_weight_kg: isWeight && form.box_weight_kg ? parseFloat(form.box_weight_kg) : null,
        cargo_price: parseFloat(form.cargo_price),
      })
      notify('success')
      // Backend yaratgan barkodni ko'rsatamiz (donali ham, kiloli ham)
      const data = res.data
      setResult(data?.barcode ? data : { barcode: 'BC-' + form.name.slice(0, 3).toUpperCase(), print_url: '#', quantity: parseInt(form.quantity, 10) })
    } catch (err) { setError(extractErrorMessage(err)); notify('error') }
    finally { setLoading(false) }
  }

  // Barkod natija ekrani
  if (result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 animate-scale-in">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
          style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 12px 32px rgba(34,197,94,0.4)' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Yuk qabul qilindi!</h2>
        <p className="text-sm text-slate-500 mb-5">Barkod yaratildi — chiqaring va yopishtiring</p>

        <div className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
          <div className="flex justify-between"><span className="text-sm text-slate-500">Mahsulot</span>
            <span className="font-semibold text-slate-900">{form.name}</span></div>
          <div className="flex justify-between"><span className="text-sm text-slate-500">Barkod</span>
            <span className="font-mono font-bold text-slate-900">{result.barcode}</span></div>
          <div className="flex justify-between"><span className="text-sm text-slate-500">Nusxa soni</span>
            <span className="font-semibold text-slate-900">{result.quantity} dona</span></div>
        </div>

        {/* Barkod vizual (text bilan) */}
        <div className="w-full bg-white rounded-2xl border-2 border-dashed border-slate-200 p-5 mt-3 text-center">
          <div className="flex justify-center gap-[2px] mb-2">
            {Array.from({ length: 32 }).map((_, i) => (
              <div key={i} className="bg-slate-900" style={{ width: i % 3 === 0 ? 3 : 1.5, height: 48 }} />
            ))}
          </div>
          <p className="font-mono text-sm font-bold tracking-widest">{result.barcode}</p>
        </div>

        <a href={result.print_url} target="_blank" rel="noopener noreferrer"
          style={{ background: 'var(--brand-gradient)' }}
          className="press w-full text-white rounded-2xl py-4 font-bold mt-5 text-center shadow-[var(--shadow-brand)]">
          🖨️ Barkod chiqarish ({result.quantity} nusxa)
        </a>
        <button onClick={() => { setResult(null); setForm({ name: '', category: '', type: 'piece', quantity: '', weight_kg: '', box_weight_kg: '', cargo_price: '' }) }}
          className="press w-full bg-slate-100 text-slate-700 rounded-2xl py-3.5 font-semibold mt-3">
          Yangi yuk qabul qilish
        </button>
        <button onClick={() => navigate('/warehouse-uz')}
          className="press text-slate-400 text-sm font-medium mt-3">
          Bosh sahifaga
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-32 animate-fade-in">
      <Header title="Yuk qabul qilish" subtitle="Yangi mahsulot kiritish" showBack />

      <form onSubmit={handleSubmit} className="px-4 pt-5 space-y-4">
        <Input label="Mahsulot nomi" placeholder="Masalan: Krasovka Nike"
          value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />

        <Input label="Kategoriya" placeholder="Poyabzal, tekstil, elektronika..."
          value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />

        {/* Yuk turi */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Yuk turi</label>
          <div className="bg-slate-100 rounded-2xl p-1 grid grid-cols-2 gap-1">
            {([
              { key: 'piece' as const, label: '📦 Donali' },
              { key: 'weight' as const, label: '🧵 Kiloli (tekstil)' },
            ]).map((opt) => {
              const active = form.type === opt.key
              return (
                <button key={opt.key} type="button"
                  onClick={() => { haptic('light'); setForm({ ...form, type: opt.key }) }}
                  className={`py-3 rounded-xl text-sm font-semibold transition-all ${active ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <Input type="number" label="Soni (dona)" placeholder="600"
            value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
          {isWeight && (
            <Input type="number" label="Jami (kg)" placeholder="500"
              value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} required />
          )}
        </div>

        {isWeight && (
          <div className="animate-fade-in">
            <Input type="number" label="Kartonka vazni (kg)" placeholder="Ixtiyoriy — quti og'irligi"
              value={form.box_weight_kg} onChange={(e) => setForm({ ...form, box_weight_kg: e.target.value })} />
          </div>
        )}

        <Input type="number"
          label={isWeight ? 'Cargo narxi (1 kg uchun)' : 'Cargo narxi (1 dona uchun)'}
          placeholder="so'mda"
          value={form.cargo_price} onChange={(e) => setForm({ ...form, cargo_price: e.target.value })} required />

        {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl">{error}</div>}
      </form>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100">
        <Button fullWidth loading={loading} onClick={handleSubmit}>Qabul qilish va barkod yaratish</Button>
      </div>
    </div>
  )
}
