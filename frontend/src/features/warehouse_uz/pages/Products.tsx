import { useQuery } from '@tanstack/react-query'
import client from '@/shared/api/client'
import type { Product } from '@/shared/types'
import { PRODUCT_STATUS } from '@/shared/lib/status'
import { Header, ListSkeleton, EmptyState, StatusBadge, IconBox } from '@/shared/ui'

export default function Products() {
  const { data: products, isLoading } = useQuery({
    queryKey: ['warehouse-uz-products'],
    queryFn: () => client.get<Product[]>('/warehouse-uz/products').then((r) => r.data),
  })

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title="Ombordagi mahsulotlar" subtitle="Toshkent ombori holati" showBack />

      {isLoading ? (
        <ListSkeleton />
      ) : !products?.length ? (
        <EmptyState icon={<IconBox size={30} />} title="Mahsulot yo'q" description="Hozircha omborda mahsulot yo'q" />
      ) : (
        <div className="px-4 pt-4 space-y-3">
          {products.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center text-xl shrink-0">
                  {p.type === 'weight' ? '🧵' : '📦'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-slate-900 truncate">{p.name}</h3>
                    <StatusBadge tone={PRODUCT_STATUS[p.status].tone} dot>{PRODUCT_STATUS[p.status].text}</StatusBadge>
                  </div>
                  <p className="text-xs text-slate-400">{p.category}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {p.type === 'weight' ? (
                      <>
                        <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">{p.weight_kg} kg</span>
                        <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">{p.quantity} dona</span>
                      </>
                    ) : (
                      <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">{p.quantity} dona</span>
                    )}
                    {p.box_weight_kg ? (
                      <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">
                        Kartonka: {p.box_weight_kg} kg
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
