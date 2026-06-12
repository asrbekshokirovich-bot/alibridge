import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { Header } from './Header'
import { ScanInput } from './ScanInput'
import { SuccessScreen } from './States'
import { IconCheck } from './icons'

interface VariantAvailability {
  variant_id: number
  size_label: string
  available: number
}

interface ScanData {
  barcode: string
  product_name: string
  available_by_variant?: VariantAvailability[]
  [key: string]: unknown
}

// Skanlangan qator: barkod + variant + tanlangan miqdor (+ manbada bori)
interface ScannedRow {
  key: string // `${barcode}:${variant_id}`
  barcode: string
  product_name: string
  variant_id: number
  size_label: string
  available: number
  quantity: number
}

interface Props {
  title: string
  subtitle?: string
  scanUrl: string
  confirmUrl: string
  scanBody?: Record<string, unknown>
  confirmBody?: Record<string, unknown>
  successTitle: string
  successDesc?: (count: number) => string
  showBack?: boolean
  onBack?: () => void
}

const rowKey = (barcode: string, variantId: number) => `${barcode}:${variantId}`

// Miqdor bo'yicha skanlash sessiyasi (split custody) — har skan +1, qo'lda tahrir
export function ScanSession({
  title, subtitle, scanUrl, confirmUrl, scanBody = {}, confirmBody = {},
  successTitle, successDesc, showBack, onBack,
}: Props) {
  const { notify } = useTelegram()
  const [barcode, setBarcode] = useState('')
  const [rows, setRows] = useState<ScannedRow[]>([])
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  // O'lcham tanlash kerak bo'lganda (ko'p variant): skan natijasi shu yerda kutadi
  const [pending, setPending] = useState<ScanData | null>(null)

  const totalQty = rows.reduce((s, r) => s + r.quantity, 0)

  // Skanlangan variantni ro'yxatga qo'shadi yoki mavjud bo'lsa +1
  const addVariant = (data: ScanData, v: VariantAvailability) => {
    setRows((prev) => {
      const key = rowKey(data.barcode, v.variant_id)
      const existing = prev.find((r) => r.key === key)
      if (existing) {
        if (existing.quantity >= v.available) {
          notify('warning')
          setError(`Omborda faqat ${v.available} ta bor`)
          return prev
        }
        return prev.map((r) => (r.key === key ? { ...r, quantity: r.quantity + 1 } : r))
      }
      return [
        {
          key,
          barcode: data.barcode,
          product_name: data.product_name,
          variant_id: v.variant_id,
          size_label: v.size_label,
          available: v.available,
          quantity: 1,
        },
        ...prev,
      ]
    })
    setError('')
    notify('success')
  }

  const scan = useMutation({
    mutationFn: (bc: string) =>
      client.post<ScanData>(scanUrl, { barcode: bc, ...scanBody }).then((r) => r.data),
    onSuccess: (data) => {
      setBarcode('')
      const variants = data.available_by_variant ?? []
      if (variants.length === 0) {
        setError('Bu yukdan qolmagan')
        notify('error')
        return
      }
      if (variants.length === 1) {
        addVariant(data, variants[0])
      } else {
        // Ko'p o'lcham — qaysi birini tanlashni so'raymiz
        setPending(data)
      }
    },
    onError: (err) => { setError(extractErrorMessage(err)); notify('error') },
  })

  const confirm = useMutation({
    mutationFn: () =>
      client.post(confirmUrl, {
        items: rows.map((r) => ({
          barcode: r.barcode,
          variant_id: r.variant_id,
          quantity: r.quantity,
        })),
        ...confirmBody,
      }),
    onSuccess: () => { notify('success'); setDone(true) },
    onError: (err) => { setError(extractErrorMessage(err)); notify('error') },
  })

  const handleScan = () => {
    const bc = barcode.trim()
    if (!bc) return
    setError('')
    scan.mutate(bc)
  }

  const setQty = (key: string, qty: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.key === key ? { ...r, quantity: Math.max(1, Math.min(qty, r.available)) } : r,
      ),
    )
  }

  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key))

  if (done) {
    return <SuccessScreen title={successTitle}
      description={successDesc?.(totalQty) ?? `${totalQty} ta mahsulot qayta ishlandi`} />
  }

  return (
    <div className="min-h-screen flex flex-col animate-fade-in">
      <Header title={title} subtitle={subtitle} showBack={showBack} onBack={onBack} />

      <ScanInput value={barcode} onChange={setBarcode}
        onScan={handleScan} loading={scan.isPending} />

      {error && (
        <div className="mx-4 -mt-1 mb-2 bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-xl animate-fade-in">{error}</div>
      )}

      {/* O'lcham tanlash (ko'p variantli mahsulot skanlanganda) */}
      {pending && (
        <div className="mx-4 mb-3 bg-white rounded-2xl border border-slate-200 p-4 animate-scale-in">
          <p className="text-sm font-bold text-slate-900 mb-1">{pending.product_name}</p>
          <p className="text-xs text-slate-400 mb-3">O'lchamni tanlang</p>
          <div className="flex flex-wrap gap-2">
            {(pending.available_by_variant ?? []).map((v) => (
              <button
                key={v.variant_id}
                onClick={() => { addVariant(pending, v); setPending(null) }}
                className="press px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-red-300"
              >
                {v.size_label || 'O\'lcham'} · {v.available} ta
              </button>
            ))}
          </div>
          <button onClick={() => setPending(null)} className="mt-3 text-xs text-slate-400">Bekor qilish</button>
        </div>
      )}

      {/* Sanagich */}
      {rows.length > 0 && (
        <div className="px-4 pb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-700">Jami</span>
          <span className="text-sm font-bold px-2.5 py-0.5 rounded-full text-white" style={{ background: 'var(--brand-gradient)' }}>
            {totalQty} ta
          </span>
        </div>
      )}

      {/* Ro'yxat — har qatorда miqdor boshqaruvi */}
      <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-32">
        {rows.map((r) => (
          <div key={r.key} className="bg-white rounded-2xl p-3.5 border border-emerald-200 flex items-center gap-3 animate-scale-in">
            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <IconCheck size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-slate-900 truncate">
                {r.product_name}{r.size_label ? ` · ${r.size_label}` : ''}
              </p>
              <p className="text-xs font-mono text-slate-400">{r.barcode} · max {r.available}</p>
            </div>
            {/* Miqdor: − [son] + */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => setQty(r.key, r.quantity - 1)}
                className="press w-7 h-7 rounded-lg bg-slate-100 text-slate-600 font-bold flex items-center justify-center">−</button>
              <input
                type="number"
                value={r.quantity}
                onChange={(e) => setQty(r.key, parseInt(e.target.value) || 1)}
                className="w-12 text-center font-bold text-slate-900 border border-slate-200 rounded-lg py-1 text-sm"
              />
              <button onClick={() => setQty(r.key, r.quantity + 1)}
                className="press w-7 h-7 rounded-lg bg-slate-100 text-slate-600 font-bold flex items-center justify-center">+</button>
              <button onClick={() => removeRow(r.key)}
                className="press w-7 h-7 rounded-lg text-red-400 flex items-center justify-center">🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {/* Tasdiqlash */}
      {rows.length > 0 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100">
          <button onClick={() => confirm.mutate()} disabled={confirm.isPending}
            style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
            className="press w-full text-white rounded-2xl py-4 font-bold shadow-[0_8px_24px_rgba(34,197,94,0.35)] disabled:opacity-50">
            {confirm.isPending ? 'Yuklanmoqda...' : `Tasdiqlash (${totalQty} ta)`}
          </button>
        </div>
      )}
    </div>
  )
}
