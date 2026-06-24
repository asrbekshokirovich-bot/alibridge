import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import client from '@/shared/api/client'
import { productGroup } from '@/shared/lib/product'
import { Header, ListSkeleton, EmptyState, StatusBadge, IconBox } from '@/shared/ui'
import type { Product } from '@/shared/types'

const CHIP = 'text-xs font-semibold px-2 py-0.5 rounded-lg'
const CHIP_STYLE: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', color: 'var(--muted)' }
const CHIP_MUTED = 'text-xs font-medium px-2 py-0.5 rounded-lg'
const CHIP_MUTED_STYLE: React.CSSProperties = { background: 'var(--surface2)', color: 'var(--muted2)' }

export default function Products() {
  const { t } = useTranslation()
  const STATUS_LABEL: Record<string, { label: string; tone: 'green' | 'yellow' | 'red' | 'gray' | 'blue' }> = {
    in_warehouse_uz: { label: t('Toshkent omborida'), tone: 'blue' },
    pending_admin: { label: t('Tasdiq kutilmoqda'), tone: 'yellow' },
    confirmed: { label: t('Tasdiqlangan'), tone: 'green' },
    with_carrier: { label: t('Yo\'lovchida'), tone: 'yellow' },
    delivered_tr: { label: t('Turkiyada'), tone: 'green' },
    damaged: { label: t('Shikastlangan'), tone: 'red' },
  }
  const { data, isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () => client.get<Product[]>('/admin/products').then((r) => r.data),
  })

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title={t('Mahsulotlar')} subtitle={t('Barcha yuklar')} showBack />

      {isLoading ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState icon={<IconBox size={30} />} title={t('Mahsulot yo\'q')} description={t('Hali mahsulot qo\'shilmagan')} />
      ) : (
        <div className="px-4 pt-4 space-y-3 web-grid">
          {data.map((p) => {
            const st = STATUS_LABEL[p.status] ?? { label: p.status, tone: 'gray' as const }
            const g = productGroup(p.type)
            const unit = g === 'piece' ? 'dona' : 'kg'
            // Haqiqiy variantlar (bo'sh backfill emas)
            const realVariants = p.variants?.filter((v) => v.size_label || v.quantity || v.weight_kg) ?? []
            const totalQty = realVariants.reduce((s, v) => s + (v.quantity || 0), 0)
            const totalKg = realVariants.reduce((s, v) => s + Math.max(0, (v.weight_kg || 0) - (v.tare_kg || 0)), 0)
            const jamiParts = [
              totalQty > 0 ? t('{{n}} dona', { n: totalQty }) : '',
              g !== 'piece' && totalKg >= 0.1 ? t('{{n}} kg', { n: totalKg.toFixed(1) }) : '',
            ].filter(Boolean)
            return (
              <div key={p.id} className="rounded-2xl p-3.5 border" style={{ background: 'var(--card-gradient)', borderColor: 'var(--line2)', boxShadow: 'var(--shadow-md)' }}>
                <div className="flex items-stretch gap-3">
                  {/* Chap: katta rasm */}
                  <div className="w-24 h-24 rounded-xl flex items-center justify-center shrink-0 overflow-hidden self-start" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--muted3)' }}>
                    {p.image_url
                      ? <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                      : <IconBox size={32} />}
                  </div>

                  {/* O'rta: nomi, barkod, status, o'lchamlar + narx, jami */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold truncate flex-1 text-[14.5px]" style={{ color: 'var(--ink)' }}>{p.name}</h3>
                      <StatusBadge tone={st.tone} dot>{st.label}</StatusBadge>
                    </div>
                    <p className="text-xs font-mono truncate" style={{ color: 'var(--muted2)' }}>{p.barcode}</p>

                    {realVariants.length > 0 ? (
                      <>
                        <div className="mt-2 space-y-1">
                          {realVariants.map((v) => (
                            <div key={v.id} className="flex items-center gap-2 flex-wrap text-xs">
                              {v.size_label && (
                                <span className="font-bold px-2 py-0.5 rounded-lg" style={{ background: 'rgba(106,163,255,0.14)', color: 'var(--brand-light)' }}>{v.size_label}</span>
                              )}
                              {v.quantity > 0 && <span className={CHIP} style={CHIP_STYLE}>{t('{{n}} dona', { n: v.quantity })}</span>}
                              {g === 'boxed' && v.box_count != null && v.box_count > 0 && <span className={CHIP} style={CHIP_STYLE}>{t('{{n}} quti', { n: v.box_count })}</span>}
                              {v.weight_kg > 0 && <span className={CHIP} style={CHIP_STYLE}>{t('{{n}} kg', { n: v.weight_kg })}</span>}
                              {v.tare_kg != null && v.tare_kg > 0 && (
                                <>
                                  <span className={CHIP} style={CHIP_STYLE}>{t('{{n}} kg sof', { n: Math.max(0, v.weight_kg - v.tare_kg).toFixed(1) })}</span>
                                  <span className={CHIP_MUTED} style={CHIP_MUTED_STYLE}>{t('tara {{n}}', { n: v.tare_kg })}</span>
                                </>
                              )}
                              {v.cargo_price > 0 && (
                                <span className="font-bold ml-auto tabular-nums" style={{ color: 'var(--lime)' }}>
                                  ${v.cargo_price}/{unit}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                        {jamiParts.length > 0 && (
                          <p className="text-xs font-semibold mt-1.5" style={{ color: 'var(--muted)' }}>{t('Jami:')} {jamiParts.join(' · ')}</p>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                        <span className={CHIP} style={CHIP_STYLE}>{g === 'piece' ? t('{{n}} dona', { n: p.quantity }) : t('{{kg}} kg · {{n}} dona', { kg: p.weight_kg, n: p.quantity })}</span>
                        {p.cargo_price > 0 && (
                          <span className="font-bold ml-auto tabular-nums" style={{ color: 'var(--lime)' }}>${p.cargo_price}/{unit}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
