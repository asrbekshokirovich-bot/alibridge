import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import client from '@/shared/api/client'
import type { CarrierOrder, OrderStatus, CarrierMyProduct } from '@/shared/types'
import { ORDER_STATUS } from '@/shared/lib/status'
import { isPiece } from '@/shared/lib/product'
import { Header, ListSkeleton, EmptyState, StatusBadge, IconBag, IconBox, IconPlane, IconAlert } from '@/shared/ui'

export default function MyOrders() {
  const { t } = useTranslation()
  const { data: orders, isLoading } = useQuery({
    queryKey: ['carrier-orders'],
    queryFn: () => client.get<CarrierOrder[]>('/carrier/orders').then((r) => r.data),
  })

  // Kuryer aeroportда topshirgan, hozir qo'limizда turgan yuklar
  const { data: received } = useQuery({
    queryKey: ['carrier-my-products'],
    queryFn: () => client.get<CarrierMyProduct[]>('/carrier/my-products').then((r) => r.data),
    refetchInterval: 15000, // kuryer topshirsa o'zi yangilanadi
  })

  const receivedTotal = (received ?? []).reduce((s, p) => s + p.quantity, 0)
  const hasContent = (orders?.length ?? 0) > 0 || (received?.length ?? 0) > 0

  return (
    <div className="min-h-screen pb-28 animate-fade-in">
      <Header title={t('Mening yuklarim')} subtitle={t('Buyurtmalaringiz holati')} />

      {/* Qo'limdagi yuklar — kuryer aeroportда topshirgan, hozir yo'lovchida */}
      {(received?.length ?? 0) > 0 && (
        <div className="px-4 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[15px]" style={{ color: 'var(--ink)' }}>{t('Qo\'limdagi yuklar')}</h3>
            <span className="text-xs font-bold text-white px-2.5 py-0.5 rounded-full" style={{ background: 'var(--royal)' }}>
              {t('{{count}} dona', { count: receivedTotal })}
            </span>
          </div>
          <div className="rounded-2xl border divide-y" style={{ background: 'var(--surface)', borderColor: 'var(--line)', boxShadow: 'var(--shadow-md)' }}>
            {received!.map((p) => (
              <div key={`${p.product_id}-${p.size_label}`} className="flex items-center gap-3 p-3.5" style={{ borderColor: 'var(--line)' }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden shrink-0" style={{ background: '#EAEEF4', color: 'var(--muted3)' }}>
                  {p.image_url
                    ? <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                    : <IconBox size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: 'var(--ink)' }}>
                    {p.category || p.product_name}
                    {p.size_label && <span className="font-normal" style={{ color: 'var(--muted3)' }}> · {p.size_label}</span>}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    {p.barcode}{p.received_at && ` · ${p.received_at}`}
                  </p>
                </div>
                <span className="text-sm font-bold shrink-0 tabular-nums" style={{ color: 'var(--ink)' }}>{t('{{count}} dona', { count: p.quantity })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <ListSkeleton />
      ) : !hasContent ? (
        <EmptyState icon={<IconBag size={30} />} title={t('Hali yuk yo\'q')}
          description={t('Mahsulotlar bo\'limidan yuk tanlang')} />
      ) : (
        <div className="px-4 pt-4 space-y-3">
          {(orders ?? []).map((order) => {
            const st = ORDER_STATUS[order.status as OrderStatus] ?? { text: order.status, tone: 'gray' as const }
            const damaged = order.products.some((p) => p.status === 'damaged')
            return (
              <div key={order.id}
                className="rounded-2xl border overflow-hidden"
                style={{ background: 'var(--surface)', borderColor: damaged ? 'rgba(239,68,68,0.35)' : 'var(--line)', boxShadow: 'var(--shadow-md)' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--line)' }}>
                  <div>
                    <span className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{t('Buyurtma #{{id}}', { id: order.id })}</span>
                    {(order.flight_number || order.flight_date) && (
                      <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                        <IconPlane size={13} />
                        {[order.flight_number, order.flight_date].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <StatusBadge tone={st.tone} dot>{st.text}</StatusBadge>
                </div>

                {/* Mahsulotlar — items bo'lsa actual (tortilgan) qiymat, aks holda product */}
                <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
                  {(order.items ?? []).length > 0 ? (
                    order.items!.map((it) => (
                      <div key={it.variant_id ?? it.product_id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderColor: 'var(--line)' }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#EAEEF4', color: 'var(--muted3)' }}>
                          <IconBox size={15} />
                        </div>
                        <span className="flex-1 text-sm truncate" style={{ color: 'var(--ink)' }}>
                          {it.product_name}{it.size_label ? ` · ${it.size_label}` : ''}
                        </span>
                        <span className="text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
                          {isPiece(it.type)
                            ? t('{{count}} dona', { count: it.actual_quantity ?? it.amount })
                            : (it.confirmed && it.actual_kg != null
                                ? t('{{kg}} kg, {{count}} dona', { kg: it.actual_kg, count: it.actual_quantity })
                                : t('{{kg}} kg', { kg: it.amount }))}
                        </span>
                      </div>
                    ))
                  ) : (
                    order.products.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderColor: 'var(--line)' }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#EAEEF4', color: 'var(--muted3)' }}>
                          <IconBox size={15} />
                        </div>
                        <span className="flex-1 text-sm truncate" style={{ color: 'var(--ink)' }}>{p.name}</span>
                        <span className="text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
                          {isPiece(p.type) ? t('{{count}} dona', { count: p.quantity }) : t('{{kg}} kg', { kg: p.weight_kg })}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {damaged && (
                  <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.08)' }}>
                    <span style={{ color: 'var(--red)' }}><IconAlert size={16} /></span>
                    <span className="text-xs font-medium" style={{ color: 'var(--red)' }}>{t('Zarar yetgan mahsulot mavjud')}</span>
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
