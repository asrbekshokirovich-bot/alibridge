import { useQuery } from '@tanstack/react-query'
import client from '@/shared/api/client'
import { Header, ListSkeleton, EmptyState, IconBox } from '@/shared/ui'

interface MyProduct {
  product_id: number
  barcode: string
  product_name: string
  category: string
  image_url: string | null
  carrier_name: string | null
  carrier_number: number | null
  picked_up_at: string
}

export default function CourierUzMyProducts() {
  const { data, isLoading } = useQuery({
    queryKey: ['courier-uz-my-products'],
    queryFn: () => client.get<MyProduct[]>('/courier-uz/my-products').then((r) => r.data),
  })

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title="Mening yuklarim" subtitle="Hozir sizda turgan yuklar" showBack />

      {data && data.length > 0 && (
        <div className="px-4 pt-3">
          <div className="rounded-2xl px-4 py-3 flex items-center justify-between" style={{ background: 'var(--brand-gradient-soft)' }}>
            <span className="text-sm font-semibold text-red-900/80">Aeroportда topshirilishi kerak</span>
            <span className="text-lg font-extrabold" style={{ color: 'var(--brand)' }}>{data.length}</span>
          </div>
        </div>
      )}

      {isLoading ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState
          icon={<IconBox size={30} />}
          title="Yuk yo'q"
          description="Hozircha sizda olib yurgan yuk yo'q. Ombordan yuk oling."
        />
      ) : (
        <div className="px-4 pt-4 space-y-3 web-grid">
          {data.map((p) => (
            <div key={p.product_id} className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-slate-50 flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : '📦'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 truncate">{p.product_name}</p>
                <p className="text-[11px] font-mono text-slate-400">{p.barcode}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {p.carrier_number ? (
                    <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                      Yo'lovchi #{p.carrier_number}
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">
                      Buyurtmasiz
                    </span>
                  )}
                  {p.picked_up_at && (
                    <span className="text-[11px] text-slate-400">{p.picked_up_at}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
