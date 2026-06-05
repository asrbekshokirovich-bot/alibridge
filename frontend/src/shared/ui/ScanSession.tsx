import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { Header } from './Header'
import { ScanInput } from './ScanInput'
import { SuccessScreen } from './States'
import { IconCheck } from './icons'

export interface ScannedItem {
  barcode: string
  product_name: string
  [key: string]: unknown
}

interface Props {
  title: string
  subtitle?: string
  scanUrl: string
  confirmUrl: string
  scanBody?: Record<string, unknown>      // har skanda qo'shimcha yuboriladigan
  confirmBody?: Record<string, unknown>   // tasdiqlashda qo'shimcha
  successTitle: string
  successDesc?: (count: number) => string
  renderItem?: (item: ScannedItem) => React.ReactNode
  showBack?: boolean
  onBack?: () => void
}

// Barcha barkod skanlash sahifalari uchun umumiy sessiya
export function ScanSession({
  title, subtitle, scanUrl, confirmUrl, scanBody = {}, confirmBody = {},
  successTitle, successDesc, renderItem, showBack, onBack,
}: Props) {
  const { notify } = useTelegram()
  const [barcode, setBarcode] = useState('')
  const [items, setItems] = useState<ScannedItem[]>([])
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const scan = useMutation({
    mutationFn: (bc: string) =>
      client.post<ScannedItem>(scanUrl, { barcode: bc, ...scanBody }).then((r) => r.data),
    onSuccess: (data) => {
      // mock paytida product_name bo'lmasligi mumkin
      const item: ScannedItem = data?.barcode ? data : { barcode, product_name: 'Mahsulot' }
      setItems((p) => [item, ...p])
      setBarcode('')
      notify('success')
    },
    onError: (err) => { setError(extractErrorMessage(err)); notify('error') },
  })

  const confirm = useMutation({
    mutationFn: () => client.post(confirmUrl, { barcodes: items.map((i) => i.barcode), ...confirmBody }),
    onSuccess: () => { notify('success'); setDone(true) },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  // Barkodni skanlash — dublikat tekshiruvi bilan
  const handleScan = () => {
    const bc = barcode.trim()
    if (!bc) return
    setError('')
    // Bir barkod ikki marta skanlanmasin
    if (items.some((i) => i.barcode === bc)) {
      notify('warning')
      setError('Bu barkod allaqachon skanlangan')
      setBarcode('')
      return
    }
    scan.mutate(bc)
  }

  if (done) {
    return <SuccessScreen title={successTitle}
      description={successDesc?.(items.length) ?? `${items.length} ta mahsulot qayta ishlandi`} />
  }

  return (
    <div className="min-h-screen flex flex-col animate-fade-in">
      <Header title={title} subtitle={subtitle} showBack={showBack} onBack={onBack} />

      <ScanInput value={barcode} onChange={setBarcode}
        onScan={handleScan} loading={scan.isPending} />

      {error && (
        <div className="mx-4 -mt-1 mb-2 bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-xl animate-fade-in">{error}</div>
      )}

      {/* Sanagich */}
      {items.length > 0 && (
        <div className="px-4 pb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-700">Skanlandi</span>
          <span className="text-sm font-bold px-2.5 py-0.5 rounded-full text-white" style={{ background: 'var(--brand-gradient)' }}>
            {items.length}
          </span>
        </div>
      )}

      {/* Ro'yxat */}
      <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-32">
        {items.map((item, i) => (
          <div key={i} className="bg-white rounded-2xl p-3.5 border border-emerald-200 flex items-center gap-3 animate-scale-in">
            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <IconCheck size={18} />
            </div>
            <div className="flex-1 min-w-0">
              {renderItem ? renderItem(item) : (
                <>
                  <p className="font-semibold text-sm text-slate-900 truncate">{item.product_name}</p>
                  <p className="text-xs font-mono text-slate-400">{item.barcode}</p>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Tasdiqlash */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100">
          <button onClick={() => confirm.mutate()} disabled={confirm.isPending}
            style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
            className="press w-full text-white rounded-2xl py-4 font-bold shadow-[0_8px_24px_rgba(34,197,94,0.35)] disabled:opacity-50">
            {confirm.isPending ? 'Yuklanmoqda...' : `Tasdiqlash (${items.length} ta)`}
          </button>
        </div>
      )}
    </div>
  )
}
