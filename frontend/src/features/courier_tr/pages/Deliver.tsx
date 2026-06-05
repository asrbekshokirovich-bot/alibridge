import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '@/shared/api/client'
import { Header, ListSkeleton, EmptyState, ScanSession, IconTruck } from '@/shared/ui'

interface DeliveryItem {
  id: number; address: string; recipient_name: string; products_count: number
}

export default function Deliver() {
  const [selected, setSelected] = useState<DeliveryItem | null>(null)

  const { data: deliveries, isLoading } = useQuery({
    queryKey: ['courier-tr-deliveries'],
    queryFn: () => client.get<DeliveryItem[]>('/courier-tr/deliveries').then((r) => r.data),
  })

  // Tanlangan yetkazishni skanlash
  if (selected) {
    return (
      <ScanSession
        title={selected.recipient_name}
        subtitle={selected.address}
        showBack
        onBack={() => setSelected(null)}
        scanUrl="/courier-tr/scan-delivery"
        confirmUrl="/courier-tr/confirm-delivery"
        scanBody={{ delivery_id: selected.id }}
        confirmBody={{ delivery_id: selected.id }}
        successTitle="Yetkazildi!"
        successDesc={(n) => `${n} ta mahsulot topshirildi.`}
      />
    )
  }

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title="Yuklarni yetkazish" subtitle="Buyurtmachilarga topshirish" showBack />

      {isLoading ? (
        <ListSkeleton />
      ) : !deliveries?.length ? (
        <EmptyState icon={<IconTruck size={30} />} title="Yetkazish yo'q" description="Hozircha yetkazish kerak bo'lgan yuk yo'q" />
      ) : (
        <div className="px-4 pt-4 space-y-3">
          {deliveries.map((d) => (
            <button key={d.id} onClick={() => setSelected(d)}
              className="press w-full bg-white rounded-2xl p-4 border border-slate-100 shadow-sm text-left flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                <IconTruck size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 truncate">{d.recipient_name}</h3>
                <p className="text-xs text-slate-500 truncate">📍 {d.address}</p>
                <span className="inline-flex mt-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                  {d.products_count} ta mahsulot
                </span>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-slate-300 shrink-0">
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
