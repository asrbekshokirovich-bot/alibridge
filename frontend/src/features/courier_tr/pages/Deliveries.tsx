import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { Header, ListSkeleton, EmptyState, ScanSession, IconTruck } from '@/shared/ui'

interface Delivery {
  id: number
  address: string
  recipient_name: string
  products_count: number
}

export default function Deliveries() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const [active, setActive] = useState<Delivery | null>(null)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['courier-tr-deliveries'],
    queryFn: () => client.get<Delivery[]>('/courier-tr/deliveries').then((r) => r.data),
  })

  // 2-bosqich: tanlangan buyurtma yuklarini skanlash
  if (active) {
    return (
      <ScanSession
        title="Yetkazish"
        subtitle={active.recipient_name}
        showBack
        onBack={() => setActive(null)}
        scanUrl="/courier-tr/scan-delivery"
        confirmUrl="/courier-tr/confirm-delivery"
        scanBody={{ delivery_id: active.id }}
        confirmBody={{ delivery_id: active.id }}
        successTitle="Yetkazildi!"
        successDesc={(n) => `${n} ta mahsulot buyurtmachiga topshirildi.`}
      />
    )
  }

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title="Yetkazish" subtitle="Buyurtmachiga topshirish" showBack
        onBack={() => navigate('/courier-tr')} />

      {isLoading ? (
        <ListSkeleton />
      ) : isError ? (
        <div className="px-4 pt-4">
          <p className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl">{extractErrorMessage(error)}</p>
        </div>
      ) : !data?.length ? (
        <EmptyState icon={<IconTruck size={30} />} title="Yetkazish yo'q"
          description="Omborda yetkazishga tayyor yuk yo'q" />
      ) : (
        <div className="px-4 pt-4 space-y-3 web-grid">
          {data.map((d) => (
            <button key={d.id}
              onClick={() => { haptic('medium'); setActive(d) }}
              className="press w-full bg-white rounded-2xl p-4 border border-slate-100 shadow-sm text-left flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0" style={{ background: 'var(--brand-gradient)' }}>
                <IconTruck size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 truncate">{d.recipient_name}</p>
                <p className="text-xs text-slate-400 truncate">{d.address || 'Manzil ko\'rsatilmagan'}</p>
              </div>
              <span className="text-xs font-bold text-white px-2.5 py-0.5 rounded-full shrink-0" style={{ background: 'var(--brand)' }}>
                {d.products_count} ta
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
