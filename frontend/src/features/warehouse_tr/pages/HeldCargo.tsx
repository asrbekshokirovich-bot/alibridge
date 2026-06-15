import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import client, { extractErrorMessage } from '@/shared/api/client'
import type { ProductType } from '@/shared/types'
import { typeEmoji } from '@/shared/lib/product'
import { Header, ListSkeleton, EmptyState, IconBox } from '@/shared/ui'

interface HeldCargo {
  product_id: number
  barcode: string
  product_name: string
  type: ProductType
  size_label: string
  quantity: number
}

export default function HeldCargo() {
  const { t } = useTranslation()
  const { data: items, isLoading, isError, error } = useQuery({
    queryKey: ['warehouse-tr-held'],
    queryFn: () => client.get<HeldCargo[]>('/warehouse-tr/held').then((r) => r.data),
  })

  const total = (items ?? []).reduce((s, p) => s + p.quantity, 0)

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title={t('Skladdagi yuklar')} subtitle={t('Hozir omborda turgan yuklar')} showBack />

      {isLoading ? (
        <ListSkeleton />
      ) : isError ? (
        <div className="px-4 pt-4">
          <p className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl">{extractErrorMessage(error)}</p>
        </div>
      ) : !items?.length ? (
        <EmptyState icon={<IconBox size={30} />} title={t("Sklad bo'sh")}
          description={t("Omborda hozir yuk yo'q")} />
      ) : (
        <>
          <div className="px-4 pt-4 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">{t('Jami')}</span>
            <span className="text-sm font-bold px-2.5 py-0.5 rounded-full text-white" style={{ background: 'var(--brand-gradient)' }}>
              {t('{{n}} ta', { n: total })}
            </span>
          </div>
          <div className="px-4 pt-3 space-y-2 web-grid">
            {items.map((p) => (
              <div key={`${p.product_id}:${p.size_label}`} className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-lg shrink-0">
                  {typeEmoji(p.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-900 truncate">
                    {p.product_name}{p.size_label ? ` · ${p.size_label}` : ''}
                  </p>
                  <p className="text-[11px] font-mono text-slate-400">{p.barcode}</p>
                </div>
                <span className="text-sm font-bold text-white px-2 py-0.5 rounded-lg shrink-0" style={{ background: 'var(--brand)' }}>
                  {t('{{n}} ta', { n: p.quantity })}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
