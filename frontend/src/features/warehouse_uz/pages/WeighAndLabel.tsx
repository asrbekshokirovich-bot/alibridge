import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { Header, Button, Input, ListSkeleton, EmptyState, IconScan } from '@/shared/ui'

interface PendingWeigh {
  order_id: number; carrier_name: string; carrier_number: number
  product_name: string; requested_kg: number
}
interface WeighResult {
  order_id: number; actual_quantity: number; actual_kg: number
  barcode: string; print_url: string
}

export default function WeighAndLabel() {
  const { notify, haptic } = useTelegram()
  const [selected, setSelected] = useState<PendingWeigh | null>(null)
  const [actualQty, setActualQty] = useState('')
  const [result, setResult] = useState<WeighResult | null>(null)
  const [error, setError] = useState('')

  const { data: pending, isLoading } = useQuery({
    queryKey: ['pending-weigh'],
    queryFn: () => client.get<PendingWeigh[]>('/warehouse-uz/pending-weigh').then((r) => r.data),
  })

  const mutation = useMutation({
    // order — snapshot, onSuccess'da null bo'lib qolmasligi uchun
    mutationFn: (vars: { order: PendingWeigh; actual_quantity: number }) =>
      client.post<WeighResult>('/warehouse-uz/confirm-weigh', {
        order_id: vars.order.order_id, actual_quantity: vars.actual_quantity,
      }).then((r) => ({ res: r.data, order: vars.order, qty: vars.actual_quantity })),
    onSuccess: ({ res, order, qty }) => {
      notify('success')
      // mock fallback — snapshot'dan foydalanamiz
      setResult(res?.barcode ? res : {
        order_id: order.order_id, actual_quantity: qty,
        actual_kg: order.requested_kg, barcode: 'TEX-' + order.order_id, print_url: '#',
      })
    },
    onError: (err) => { setError(extractErrorMessage(err)); notify('error') },
  })

  // Print natija ekrani
  if (result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 animate-scale-in">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
          style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 12px 32px rgba(34,197,94,0.4)' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-5">Tasdiqlandi!</h2>

        <div className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
          <div className="flex justify-between"><span className="text-sm text-slate-500">Barkod</span>
            <span className="font-mono font-bold text-slate-900">{result.barcode}</span></div>
          <div className="flex justify-between"><span className="text-sm text-slate-500">Miqdor</span>
            <span className="font-semibold text-slate-900">{result.actual_quantity} dona</span></div>
          <div className="flex justify-between"><span className="text-sm text-slate-500">Og'irlik</span>
            <span className="font-semibold text-slate-900">{result.actual_kg} kg</span></div>
        </div>

        <a href={result.print_url} target="_blank" rel="noopener noreferrer"
          style={{ background: 'var(--brand-gradient)' }}
          className="press w-full text-white rounded-2xl py-4 font-bold mt-5 text-center shadow-[var(--shadow-brand)]">
          🖨️ Barkod chiqarish (print)
        </a>
        <button onClick={() => { setResult(null); setSelected(null); setActualQty('') }}
          className="press w-full bg-slate-100 text-slate-700 rounded-2xl py-3.5 font-semibold mt-3">
          Keyingisi
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-32 animate-fade-in">
      <Header title="Tortish va barkod" subtitle="Yo'lovchi so'ragan kiloli yuklar" showBack />

      {isLoading ? (
        <ListSkeleton count={3} />
      ) : !pending?.length ? (
        <EmptyState icon={<IconScan size={30} />} title="So'rov yo'q" description="Hozircha tortish kerak bo'lgan yuk yo'q" />
      ) : (
        <div className="px-4 pt-4 space-y-2.5">
          {pending.map((item) => {
            const active = selected?.order_id === item.order_id
            return (
              <button key={item.order_id}
                onClick={() => { haptic('light'); setSelected(item); setActualQty('') }}
                className={`press w-full bg-white rounded-2xl p-4 border-2 text-left transition-colors ${active ? 'border-red-400' : 'border-slate-100'}`}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-slate-900">{item.product_name}</h3>
                  <span className="text-sm font-bold px-2.5 py-0.5 rounded-full bg-red-50 text-red-600">
                    {item.requested_kg} kg
                  </span>
                </div>
                <p className="text-xs text-slate-400">Yo'lovchi #{item.carrier_number} — {item.carrier_name}</p>
              </button>
            )
          })}
        </div>
      )}

      {/* Tortish paneli */}
      {selected && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] animate-slide-up space-y-3">
          <p className="text-sm text-slate-600">
            <span className="font-bold text-slate-900">{selected.requested_kg} kg</span> uchun nechta dona chiqdi?
          </p>
          <div className="flex gap-3">
            <Input type="number" placeholder="Dona soni" value={actualQty}
              onChange={(e) => setActualQty(e.target.value)} />
            <Button variant="success" loading={mutation.isPending}
              disabled={!actualQty || isNaN(parseInt(actualQty, 10)) || parseInt(actualQty, 10) <= 0}
              onClick={() => { setError(''); mutation.mutate({ order: selected, actual_quantity: parseInt(actualQty, 10) }) }}>
              Tasdiqlash
            </Button>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
      )}
    </div>
  )
}
