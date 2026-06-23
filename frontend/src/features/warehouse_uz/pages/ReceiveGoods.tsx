import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { labelUrl } from '@/shared/lib/product'
import { Header, Button, Input, IconAlert, IconBox, IconCheck } from '@/shared/ui'
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

// Tez tanlash uchun ko'p uchraydigan mahsulot turlari (chip)
const CATEGORY_PRESETS = [
  'Krasovka', 'Poyabzal', "O'yinchoq", 'Kiyim', 'Ichki kiyim',
  'Tekstil', 'Chexol', 'Telefon aksessuar', 'Elektronika', 'Aksessuar',
  'Kosmetika', 'Atir', 'Sumka', 'Soat', 'Zargarlik',
  'Sport anjomlari', 'Bolalar buyumlari', 'Idish-tovoq',
]

export default function ReceiveGoods() {
  const { t } = useTranslation()
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
        <Header title={t('Yuk qabul qilish')} subtitle={t('1-qadam: mahsulot nomi')} showBack />
        <div className="px-4 pt-5 space-y-4">
          <Input label={t('Mahsulot nomi')} placeholder={t('Masalan: Krasovka Nike')} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Input label={t('Kategoriya (ixtiyoriy)')} placeholder={t('Poyabzal, tekstil, elektronika...')} value={category} onChange={(e) => setCategory(e.target.value)} />
          <div className="flex flex-wrap gap-2 -mt-1">
            {CATEGORY_PRESETS.map((c) => {
              const active = category.trim() === c
              return (
                <button key={c} type="button"
                  onClick={() => setCategory(active ? '' : c)}
                  className="press text-sm font-semibold px-3.5 py-1.5 rounded-full border transition-colors"
                  style={active
                    ? { background: 'var(--royal)', color: '#fff', borderColor: 'transparent' }
                    : { background: 'var(--surface)', color: 'var(--muted)', borderColor: 'var(--line)' }}>
                  {t(c)}
                </button>
              )
            })}
          </div>
          <div className="rounded-2xl p-3.5 flex gap-2.5 border" style={{ background: '#EBF1FA', borderColor: 'var(--line)' }}>
            <span className="shrink-0 mt-0.5" style={{ color: 'var(--royal)' }}><IconAlert size={18} /></span>
            <p className="text-[12px] leading-snug" style={{ color: 'var(--muted)' }}>
              {t('Avval barkod yaratiladi va chop etiladi. Keyingi oynada yuk turi, soni va narxini kiritasiz.')}
            </p>
          </div>
          {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl">{error}</div>}
        </div>
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-white/80 backdrop-blur-xl border-t" style={{ borderColor: 'var(--line)' }}>
          <Button fullWidth loading={loading} disabled={!name.trim()} onClick={createBarcode}>
            {t('Barkod yaratish')}
          </Button>
        </div>
      </div>
    )
  }

  // ─── 2-QADAM: barkod + ma'lumotlar formasi ─────────────────────────────
  if (step === 'details' && created) {
    return (
      <div className="min-h-screen pb-32 animate-fade-in">
        <Header title={t('Yuk qabul qilish')} subtitle={t("2-qadam: ma'lumotlar")} showBack />

        {/* Yaratilgan barkod */}
        <div className="px-4 pt-4">
          <div className="rounded-2xl border-2 border-dashed p-4 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--line2)' }}>
            <p className="text-base font-bold truncate" style={{ color: 'var(--ink)' }}>{created.name}</p>
            <p className="text-xs mb-2.5" style={{ color: 'var(--muted)' }}>{created.received_date}</p>
            <div className="flex justify-center items-end gap-[2px] mb-1 h-10">
              {Array.from({ length: 36 }).map((_, i) => (
                <div key={i} style={{ width: i % 4 === 0 ? 3 : i % 3 === 0 ? 1 : 2, height: '100%', background: 'var(--ink)' }} />
              ))}
            </div>
            <p className="font-mono text-sm font-bold tracking-widest tabular-nums" style={{ color: 'var(--ink)' }}>{created.barcode}</p>
            <button
              onClick={() => openLink(labelUrl(created.barcode, new Date().toISOString().slice(0, 10)))}
              className="press inline-flex items-center gap-2 mt-2.5 text-sm font-bold px-4 py-2 rounded-xl text-white" style={{ background: 'var(--royal)' }}>
              <IconBox size={16} /> {t('Barkod chiqarish')}
            </button>
          </div>
        </div>

        {/* Ma'lumotlar formasi (PATCH) */}
        <ProductDetailsForm
          productId={created.id}
          submitLabel={t('Qabul qilish')}
          onSaved={() => setStep('done')}
        />
      </div>
    )
  }

  // ─── 3-QADAM: tugadi ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 animate-scale-in">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
        style={{ background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.3)', color: 'var(--green)' }}>
        <IconCheck size={40} />
      </div>
      <h2 className="text-xl font-extrabold mb-1" style={{ color: 'var(--ink)' }}>{t('Yuk qabul qilindi!')}</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>{created?.name} — {created?.barcode}</p>

      <Button fullWidth onClick={reset}>{t('Yangi yuk qabul qilish')}</Button>
      <button onClick={() => navigate('/warehouse-uz')} className="press text-sm font-semibold mt-4" style={{ color: 'var(--muted2)' }}>
        {t('Bosh sahifaga')}
      </button>
    </div>
  )
}
