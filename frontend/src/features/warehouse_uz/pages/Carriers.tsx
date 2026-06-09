import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '@/shared/api/client'
import type { Product } from '@/shared/types'
import { initials } from '@/shared/lib/format'
import { isPiece, typeEmoji } from '@/shared/lib/product'
import { Header, ListSkeleton, EmptyState, StatusBadge, Sheet, IconPlane } from '@/shared/ui'

interface Carrier {
  id: number; first_name: string; last_name: string; phone: string
  carrier_number: number; is_active: boolean; total_trips: number; has_cargo: boolean
}

export default function Carriers() {
  const [open, setOpen] = useState<Carrier | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['warehouse-uz-carriers'],
    queryFn: () => client.get<Carrier[]>('/warehouse-uz/carriers').then((r) => r.data),
  })

  // Tanlangan yo'lovchining yuklari (faqat sheet ochilganda)
  const { data: cargo, isLoading: cargoLoading } = useQuery({
    queryKey: ['warehouse-uz-carrier-products', open?.id],
    queryFn: () => client.get<Product[]>(`/warehouse-uz/carriers/${open!.id}/products`).then((r) => r.data),
    enabled: !!open,
  })

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title="Yo'lovchilar" subtitle="Yuk holati va tafsiloti" showBack />

      {isLoading ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState icon={<IconPlane size={30} />} title="Yo'lovchi yo'q" />
      ) : (
        <div className="px-4 pt-4 space-y-3">
          {data.map((c) => (
            <button
              key={c.id}
              onClick={() => c.has_cargo && setOpen(c)}
              disabled={!c.has_cargo}
              className="w-full bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3.5 text-left disabled:cursor-default"
            >
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold" style={{ background: 'var(--brand-gradient)' }}>
                  {initials(c.first_name, c.last_name)}
                </div>
                <span className="absolute -bottom-1 -right-1 bg-slate-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  #{c.carrier_number}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 truncate">{c.first_name} {c.last_name}</p>
                <p className="text-xs text-slate-400">{c.phone}</p>
                <p className="text-xs text-slate-400 mt-0.5">Jami reys: {c.total_trips}</p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <StatusBadge tone={c.has_cargo ? 'green' : 'gray'} dot>
                  {c.has_cargo ? 'Yuk bor' : 'Yuk yo\'q'}
                </StatusBadge>
                {c.has_cargo && (
                  <span className="text-[11px] text-slate-400">Yuklarni ko'rish →</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Yo'lovchining yuklari */}
      <Sheet open={!!open} onClose={() => setOpen(null)}>
        {open && (
          <div className="px-5 pt-2">
            <h3 className="font-bold text-slate-900 mb-1">{open.first_name} {open.last_name}</h3>
            <p className="text-xs text-slate-400 mb-4">Yo'lovchi #{open.carrier_number} olib ketayotgan yuklar</p>

            {cargoLoading ? (
              <ListSkeleton />
            ) : !cargo?.length ? (
              <p className="text-sm text-slate-400 py-6 text-center">Yuk topilmadi</p>
            ) : (
              <div className="space-y-2.5 pb-2">
                {cargo.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                    <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-lg shrink-0">
                      {typeEmoji(p.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{p.barcode}</p>
                    </div>
                    <span className="text-xs font-medium text-slate-600 shrink-0">
                      {isPiece(p.type) ? `${p.quantity} dona` : `${p.weight_kg} kg`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Sheet>
    </div>
  )
}
