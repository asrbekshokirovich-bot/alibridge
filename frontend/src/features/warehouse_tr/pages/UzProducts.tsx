import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import client from '@/shared/api/client'
import type { Product } from '@/shared/types'
import { PRODUCT_STATUS } from '@/shared/lib/status'
import { isPiece } from '@/shared/lib/product'
import { Header, ListSkeleton, EmptyState, StatusBadge, IconBox } from '@/shared/ui'

export default function UzProducts() {
  const { t } = useTranslation()
  const { data: products, isLoading } = useQuery({
    queryKey: ['uz-products-tr-view'],
    queryFn: () => client.get<Product[]>('/warehouse-tr/uz-products').then((r) => r.data),
  })

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title={t('Toshkent mahsulotlari')} subtitle={t('Omborlardagi holat')} showBack />

      {isLoading ? (
        <ListSkeleton />
      ) : !products?.length ? (
        <EmptyState icon={<IconBox size={30} />} title={t("Mahsulot yo'q")} />
      ) : (
        <div className="px-4 pt-4 space-y-3">
          {products.map((p) => (
            <div key={p.id} className="rounded-2xl p-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--line)', boxShadow: 'var(--shadow-md)' }}>
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 overflow-hidden" style={{ background: 'rgba(106,163,255,0.14)', color: '#6aa3ff' }}>
                  {p.image_url
                    ? <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                    : <IconBox size={22} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-[14.5px] truncate" style={{ color: 'var(--ink)' }}>{p.name}</h3>
                    <StatusBadge tone={PRODUCT_STATUS[p.status].tone} dot>{PRODUCT_STATUS[p.status].text}</StatusBadge>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--muted2)' }}>{p.category}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--muted)' }}>
                      {isPiece(p.type) ? t('{{count}} dona', { count: p.quantity }) : t('{{weight}} kg', { weight: p.weight_kg })}
                    </span>
                    {p.box_weight_kg ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-lg" style={{ background: 'rgba(251,191,36,0.14)', color: '#fbbf24' }}>
                        {t('Kartonka: {{weight}} kg', { weight: p.box_weight_kg })}
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
