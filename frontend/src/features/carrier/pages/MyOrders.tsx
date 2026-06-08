import { useQuery } from '@tanstack/react-query'
import client from '@/shared/api/client'
import type { CarrierOrder, OrderStatus } from '@/shared/types'
import { ORDER_STATUS } from '@/shared/lib/status'
import { isPiece, typeEmoji } from '@/shared/lib/product'
import { Header, ListSkeleton, EmptyState, StatusBadge, IconBag } from '@/shared/ui'

export default function MyOrders() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['carrier-orders'],
    queryFn: () => client.get<CarrierOrder[]>('/carrier/orders').then((r) => r.data),
  })

  return (
    <div className="min-h-screen pb-28 animate-fade-in">
      <Header title="Mening yuklarim" subtitle="Buyurtmalaringiz holati" />

      {isLoading ? (
        <ListSkeleton />
      ) : !orders?.length ? (
        <EmptyState icon={<IconBag size={30} />} title="Hali yuk yo'q"
          description="Mahsulotlar bo'limidan yuk tanlang" />
      ) : (
        <div className="px-4 pt-4 space-y-3">
          {orders.map((order) => {
            const st = ORDER_STATUS[order.status as OrderStatus] ?? { text: order.status, tone: 'gray' as const }
            const damaged = order.products.some((p) => p.status === 'damaged')
            return (
              <div key={order.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${damaged ? 'border-red-200' : 'border-slate-100'}`}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
                  <div>
                    <span className="text-sm font-bold text-slate-900">Buyurtma #{order.id}</span>
                    {order.flight_date && (
                      <p className="text-xs text-slate-400 mt-0.5">✈️ {order.flight_date}</p>
                    )}
                  </div>
                  <StatusBadge tone={st.tone} dot>{st.text}</StatusBadge>
                </div>

                {/* Mahsulotlar — items bo'lsa actual (tortilgan) qiymat, aks holda product */}
                <div className="divide-y divide-slate-50">
                  {(order.items ?? []).length > 0 ? (
                    order.items!.map((it) => (
                      <div key={it.product_id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-sm shrink-0">
                          {typeEmoji(it.type)}
                        </div>
                        <span className="flex-1 text-sm text-slate-700 truncate">{it.product_name}</span>
                        <span className="text-xs text-slate-400">
                          {isPiece(it.type)
                            ? `${it.actual_quantity ?? it.amount} dona`
                            : (it.confirmed && it.actual_kg != null
                                ? `${it.actual_kg} kg, ${it.actual_quantity} dona`
                                : `${it.amount} kg`)}
                        </span>
                      </div>
                    ))
                  ) : (
                    order.products.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-sm shrink-0">
                          {typeEmoji(p.type)}
                        </div>
                        <span className="flex-1 text-sm text-slate-700 truncate">{p.name}</span>
                        <span className="text-xs text-slate-400">
                          {isPiece(p.type) ? `${p.quantity} dona` : `${p.weight_kg} kg`}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {damaged && (
                  <div className="bg-red-50 px-4 py-2.5 flex items-center gap-2">
                    <span className="text-base">⚠️</span>
                    <span className="text-xs font-medium text-red-600">Zarar yetgan mahsulot mavjud</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
