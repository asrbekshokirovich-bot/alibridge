import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import client from '@/shared/api/client'
import type { CarrierOrder, OrderStatus, CarrierMyProduct, Product } from '@/shared/types'
import { ORDER_STATUS } from '@/shared/lib/status'
import { isPiece } from '@/shared/lib/product'
import { money } from '@/shared/lib/format'
import { ListSkeleton, EmptyState, StatusBadge, Barcode, IconBag, IconBox, IconPlane, IconCheck, IconScan } from '@/shared/ui'

// Reysgacha qolgan kun (flight_date "YYYY-MM-DD")
function daysLeft(date?: string): number | null {
  if (!date) return null
  const d = new Date(date + 'T00:00:00')
  if (isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

// Buyurtma bo'yicha taxminiy: yuk soni, kg, daromad (mavjud ma'lumotdan)
function orderTotals(order: CarrierOrder) {
  const ps = order.products ?? []
  const count = ps.length
  const kg = ps.reduce((s, p) => s + (p.weight_kg ?? 0), 0)
  const earn = ps.reduce((s, p) => s + (p.cargo_price ?? 0) * (isPiece(p.type) ? (p.quantity ?? 0) : (p.weight_kg ?? 0)), 0)
  return { count, kg, earn }
}

function productStatusVisual(p: Product) {
  if (p.status === 'damaged') return { tone: 'red' as const, label: '', icon: <IconScan size={18} />, ring: 'var(--brand-tint)', stroke: 'var(--brand-light)' }
  if (p.status === 'with_carrier' || p.status === 'delivered_tr')
    return { tone: 'green' as const, label: '', icon: <IconCheck size={18} />, ring: 'rgba(61,220,132,0.12)', stroke: '#3ddc84' }
  return { tone: 'yellow' as const, label: '', icon: <IconScan size={18} />, ring: 'var(--card-3)', stroke: '#fbbf24' }
}

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
    refetchInterval: 15000,
  })

  const hasContent = (orders?.length ?? 0) > 0 || (received?.length ?? 0) > 0

  return (
    <div className="min-h-screen pb-32 animate-fade-in">
      <div className="px-4 pt-4 pb-4">
        <h1 className="text-[23px] font-extrabold tracking-[-0.02em]" style={{ color: 'var(--text)' }}>{t('Yuklarim')}</h1>
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : !hasContent ? (
        <EmptyState icon={<IconBag size={28} />} title={t('Hali yuk yo\'q')}
          description={t('Mahsulotlar bo\'limidan yuk tanlang')} />
      ) : (
        <div className="px-4 space-y-4">
          {/* Buyurtmalar — har biri reys xulosasi bilan */}
          {(orders ?? []).map((order) => {
            const st = ORDER_STATUS[order.status as OrderStatus] ?? { text: order.status, tone: 'gray' as const }
            const { count, kg, earn } = orderTotals(order)
            const dleft = daysLeft(order.flight_date)
            return (
              <div key={order.id} className="rounded-[22px] border overflow-hidden"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                {/* Reys xulosasi (hero) */}
                <div className="relative p-[18px] overflow-hidden border-b"
                  style={{ background: 'linear-gradient(160deg,#1a1115,#121216)', borderColor: 'var(--border-soft)' }}>
                  <div className="absolute -top-8 -right-5 w-[120px] h-[120px] rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle,rgba(255,77,94,0.18),transparent 70%)' }} />
                  <div className="relative flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center border"
                        style={{ background: 'var(--brand-tint)', borderColor: 'var(--brand-tint-border)', color: 'var(--brand-light)' }}>
                        <IconPlane size={17} />
                      </div>
                      <div>
                        <p className="text-sm font-extrabold" style={{ color: 'var(--text)' }}>
                          {order.flight_number ? t('Reys {{n}}', { n: order.flight_number }) : t('Buyurtma #{{id}}', { id: order.id })}
                        </p>
                        <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{order.flight_date || st.text}</p>
                      </div>
                    </div>
                    {dleft != null && dleft >= 0 ? (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                        style={{ background: 'var(--lime)', color: 'var(--bg)' }}>
                        {dleft === 0 ? t('Bugun') : t('{{count}} kun qoldi', { count: dleft })}
                      </span>
                    ) : (
                      <StatusBadge tone={st.tone} dot>{st.text}</StatusBadge>
                    )}
                  </div>

                  {/* TAS → IST route */}
                  <div className="relative flex items-center">
                    <div className="text-center">
                      <p className="text-base font-extrabold" style={{ color: 'var(--text)' }}>TAS</p>
                      <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('Toshkent')}</p>
                    </div>
                    <div className="flex-1 flex items-center px-2.5 mb-3.5">
                      <div className="flex-1 h-0.5 rounded" style={{ background: 'linear-gradient(90deg,#3a3a44,#ff5c6a)' }} />
                      <span style={{ color: 'var(--brand)', margin: '0 -2px' }}><IconPlane size={18} /></span>
                      <div className="flex-1 h-0.5 rounded" style={{ background: '#3a3a44' }} />
                    </div>
                    <div className="text-center">
                      <p className="text-base font-extrabold" style={{ color: 'var(--text)' }}>IST</p>
                      <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('Istanbul')}</p>
                    </div>
                  </div>

                  {/* Stat plitalar */}
                  <div className="flex gap-2.5 mt-[18px]">
                    <Stat value={String(count)} label={t('yuk')} />
                    <Stat value={kg > 0 ? kg.toFixed(1) : '—'} label={t('kg')} />
                    <Stat value={earn > 0 ? money(earn) : '—'} label={t('daromad')} earn />
                  </div>
                </div>

                {/* Yuk ro'yxati */}
                <div className="p-3 flex flex-col gap-2.5">
                  {order.products.map((p) => {
                    const vis = productStatusVisual(p)
                    const ps = ORDER_STATUS[p.status as OrderStatus]
                    return (
                      <div key={p.id} className="flex items-center gap-3 rounded-2xl p-3 border"
                        style={{ background: 'var(--card-2)', borderColor: 'var(--border)' }}>
                        <div className="w-[42px] h-[42px] rounded-xl flex items-center justify-center shrink-0 border"
                          style={{ background: vis.ring, borderColor: 'var(--border)', color: vis.stroke }}>
                          {vis.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate" style={{ color: 'var(--text)' }}>{p.category || p.name}</p>
                          <p className="text-[11.5px] mt-0.5 tabnum" style={{ color: 'var(--text-muted)', fontFamily: 'ui-monospace, monospace' }}>
                            {p.barcode}
                          </p>
                        </div>
                        <StatusBadge tone={vis.tone}>{ps?.text ?? p.status}</StatusBadge>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Qo'limdagi yuklar — kuryer topshirgan, barkod kuzatuvi bilan */}
          {(received?.length ?? 0) > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3 mt-1">
                <h3 className="font-extrabold text-[15px]" style={{ color: 'var(--text)' }}>{t("Qo'limdagi yuklar")}</h3>
                <StatusBadge tone="green" dot>{t('{{count}} dona', { count: received!.reduce((s, p) => s + p.quantity, 0) })}</StatusBadge>
              </div>
              <div className="flex flex-col gap-2.5">
                {received!.map((p) => (
                  <div key={`${p.product_id}-${p.size_label}`} className="rounded-2xl p-3.5 border"
                    style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden shrink-0 border"
                        style={{ background: 'rgba(61,220,132,0.12)', borderColor: 'rgba(61,220,132,0.25)', color: '#3ddc84' }}>
                        {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <IconBox size={20} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>
                          {p.category || p.product_name}
                          {p.size_label && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {p.size_label}</span>}
                        </p>
                        <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('{{count}} dona', { count: p.quantity })}{p.received_at && ` · ${p.received_at}`}</p>
                      </div>
                      <StatusBadge tone="green">{t('Olindi')}</StatusBadge>
                    </div>
                    {/* Kuzatuv barkodi */}
                    <div className="mt-3 pt-3 border-t flex items-center gap-3" style={{ borderColor: 'var(--border-soft)' }}>
                      <div className="flex-1 min-w-0 opacity-90"><Barcode value={p.barcode} height={34} /></div>
                      <span className="text-[11px] tabnum shrink-0" style={{ color: 'var(--text-muted)', fontFamily: 'ui-monospace, monospace' }}>{p.barcode}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ value, label, earn }: { value: string; label: string; earn?: boolean }) {
  return (
    <div className="flex-1 rounded-[13px] px-3 py-2.5 border" style={{ background: 'rgba(0,0,0,0.25)', borderColor: 'var(--border-strong)' }}>
      <p className="text-[19px] font-extrabold tabnum" style={{ color: earn ? 'var(--lime)' : 'var(--text)' }}>{value}</p>
      <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  )
}
