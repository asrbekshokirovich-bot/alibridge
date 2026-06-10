import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { Header, ListSkeleton, EmptyState, StatusBadge, IconList, IconCheck } from '@/shared/ui'

interface QueueProduct {
  barcode: string
  product_name: string
  size_label: string
  picked_up: boolean
}

interface QueueItem {
  id: number
  carrier_name: string
  carrier_number: number | null
  address: string
  products_count: number
  status: 'pending' | 'done'
  products: QueueProduct[]
  confirmed_by_name: string | null
  created_at: string
}

export default function CourierUzQueue() {
  const qc = useQueryClient()
  const { notify, haptic } = useTelegram()
  const [error, setError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['courier-uz-queue'],
    queryFn: () => client.get<QueueItem[]>('/courier-uz/queue').then((r) => r.data),
  })

  const pickup = useMutation({
    mutationFn: (vars: { orderId: number; barcodes: string[] }) =>
      client.post('/courier-uz/confirm-pickup', { barcodes: vars.barcodes }),
    onSuccess: () => {
      notify('success')
      setError('')
      qc.invalidateQueries({ queryKey: ['courier-uz-queue'] })
    },
    onError: (err) => { setError(extractErrorMessage(err)); notify('error') },
  })

  const takeOrder = (item: QueueItem) => {
    haptic('medium')
    setError('')
    const left = item.products.filter((p) => !p.picked_up).map((p) => p.barcode)
    if (left.length) {
      pickup.mutate({ orderId: item.id, barcodes: left })
    } else {
      // Hech narsa qolmagan — yangilaymiz (boshqa kuryer olgan bo'lishi mumkin)
      setError('Bu buyurtmada olinadigan mahsulot qolmagan')
      qc.invalidateQueries({ queryKey: ['courier-uz-queue'] })
    }
  }

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title="Yetkazish navbati" subtitle="Yo'lovchilardan olish kerak" showBack />

      {isLoading ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState icon={<IconList size={30} />} title="Navbat bo'sh" description="Hozircha olish kerak bo'lgan yuk yo'q" />
      ) : (
        <div className="px-4 pt-4 space-y-3 web-grid">
          {data.map((item) => {
            const done = item.status === 'done'
            const busy = pickup.isPending && pickup.variables?.orderId === item.id
            return (
              <div key={item.id} className={`rounded-2xl border shadow-sm overflow-hidden ${done ? 'bg-emerald-50/40 border-emerald-200' : 'bg-white border-slate-100'}`}>
                {/* Header */}
                <div className="px-4 py-3 border-b border-slate-50">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-bold text-slate-900">
                      Yo'lovchi {item.carrier_number ? `#${item.carrier_number}` : ''}
                    </span>
                    <StatusBadge tone={done ? 'green' : 'yellow'} dot>{done ? 'Olib ketildi' : 'Kutilmoqda'}</StatusBadge>
                  </div>
                  <p className="text-xs text-slate-400">{item.carrier_name}</p>
                  {item.address && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M12 13a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {item.address}
                    </div>
                  )}
                </div>

                {/* Mahsulotlar */}
                <div className="divide-y divide-slate-50">
                  {item.products.map((p) => (
                    <div key={p.barcode} className="flex items-center gap-3 px-4 py-3">
                      {p.picked_up ? (
                        <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                          <IconCheck size={18} />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                          <span className="text-lg">📦</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {p.product_name}{p.size_label ? ` · ${p.size_label}` : ''}
                        </p>
                        <p className="text-[11px] font-mono text-slate-400">{p.barcode}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer: tugma yoki tasdiqlangan */}
                {done ? (
                  <div className="px-4 py-2.5 bg-emerald-100/50 text-xs font-medium text-emerald-700">
                    ✓ {item.confirmed_by_name ? `${item.confirmed_by_name} tasdiqladi` : 'Olib ketildi'}
                  </div>
                ) : (
                  <div className="px-4 py-3">
                    <button
                      onClick={() => takeOrder(item)}
                      disabled={busy}
                      className="press w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                      style={{ background: 'var(--brand-gradient)' }}
                    >
                      {busy ? 'Olinmoqda…' : 'Olib ketdim'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {error && (
        <div className="px-4 pt-3">
          <p className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl">{error}</p>
        </div>
      )}
    </div>
  )
}
