import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import client from '@/shared/api/client'
import { productGroup, typeEmoji } from '@/shared/lib/product'
import { Header, ListSkeleton, EmptyState, StatusBadge, IconBox } from '@/shared/ui'
import type { Product } from '@/shared/types'

const CHIP = 'text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg'
const CHIP_MUTED = 'text-xs font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg'

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
              <div key={p.id} className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm">
                <div className="flex items-stretch gap-3">
                  {/* Chap: katta rasm */}
                  <div className="w-24 h-24 rounded-xl bg-slate-50 flex items-center justify-center text-3xl shrink-0 overflow-hidden self-start">
                    {p.image_url
                      ? <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                      : typeEmoji(p.type)}
                  </div>

                  {/* O'rta: nomi, barkod, status, o'lchamlar + narx, jami */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 truncate flex-1">{p.name}</h3>
                      <StatusBadge tone={st.tone} dot>{st.label}</StatusBadge>
                    </div>
                    <p className="text-xs font-mono text-slate-400 truncate">{p.barcode}</p>

                    {realVariants.length > 0 ? (
                      <>
                        <div className="mt-2 space-y-1">
                          {realVariants.map((v) => (
                            <div key={v.id} className="flex items-center gap-2 flex-wrap text-xs">
                              {v.size_label && (
                                <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg">{v.size_label}</span>
                              )}
                              {v.quantity > 0 && <span className={CHIP}>{t('{{n}} dona', { n: v.quantity })}</span>}
                              {g === 'boxed' && v.box_count != null && v.box_count > 0 && <span className={CHIP}>{t('{{n}} quti', { n: v.box_count })}</span>}
                              {v.weight_kg > 0 && <span className={CHIP}>{t('{{n}} kg', { n: v.weight_kg })}</span>}
                              {v.tare_kg != null && v.tare_kg > 0 && (
                                <>
                                  <span className={CHIP}>{t('{{n}} kg sof', { n: Math.max(0, v.weight_kg - v.tare_kg).toFixed(1) })}</span>
                                  <span className={CHIP_MUTED}>{t('tara {{n}}', { n: v.tare_kg })}</span>
                                </>
                              )}
                              {v.cargo_price > 0 && (
                                <span className="font-bold ml-auto" style={{ color: 'var(--brand)' }}>
                                  ${v.cargo_price}/{unit}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                        {jamiParts.length > 0 && (
                          <p className="text-xs font-semibold text-slate-500 mt-1.5">{t('Jami:')} {jamiParts.join(' · ')}</p>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                        <span className={CHIP}>{g === 'piece' ? t('{{n}} dona', { n: p.quantity }) : t('{{kg}} kg · {{n}} dona', { kg: p.weight_kg, n: p.quantity })}</span>
                        {p.cargo_price > 0 && (
                          <span className="font-bold ml-auto" style={{ color: 'var(--brand)' }}>${p.cargo_price}/{unit}</span>
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
