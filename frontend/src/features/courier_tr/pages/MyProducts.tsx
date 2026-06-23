import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import client from '@/shared/api/client'
import { Header, ListSkeleton, EmptyState, IconBox } from '@/shared/ui'

interface MyProduct {
  product_id: number
  variant_id: number
  barcode: string
  product_name: string
  category: string
  image_url: string | null
  carrier_name: string | null
  carrier_number: number | null
  picked_up_at: string
  size_label: string
  quantity: number
}

export default function CourierTrMyProducts() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['courier-tr-my-products'],
    queryFn: () => client.get<MyProduct[]>('/courier-tr/my-products').then((r) => r.data),
  })

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title={t('Mendagi yuklar')} subtitle={t('Hozir sizda turgan yuklar')} showBack
        onBack={() => navigate('/courier-tr')} />

      {data && data.length > 0 && (
        <div className="px-4 pt-3">
          <div className="rounded-2xl px-4 py-3 flex items-center justify-between border" style={{ background: 'var(--surface)', borderColor: 'var(--line)', boxShadow: 'var(--shadow-md)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>{t('Omborga topshirilishi kerak')}</span>
            <span className="text-[22px] font-extrabold tabular-nums" style={{ color: 'var(--royal)' }}>
              {t('{{n}} ta', { n: data.reduce((s, p) => s + (p.quantity || 0), 0) })}
            </span>
          </div>
        </div>
      )}

      {isLoading ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState
          icon={<IconBox size={30} />}
          title={t('Yuk yo\'q')}
          description={t('Hozircha sizda olib yurgan yuk yo\'q. Yo\'lovchidan yuk qabul qiling.')}
        />
      ) : (
        <div className="px-4 pt-4 space-y-3 web-grid">
          {data.map((p) => (
            <div key={`${p.product_id}:${p.size_label}`} className="rounded-2xl p-3.5 border flex items-center gap-3" style={{ background: 'var(--surface)', borderColor: 'var(--line)', boxShadow: 'var(--shadow-md)' }}>
              <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden" style={{ background: '#EBF1FA', color: 'var(--royal)' }}>
                {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <IconBox size={24} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14.5px] font-bold truncate" style={{ color: 'var(--ink)' }}>
                  {p.product_name}{p.size_label ? ` · ${p.size_label}` : ''}
                </p>
                <p className="text-[11px] font-mono" style={{ color: 'var(--muted2)' }}>{p.barcode}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs font-bold text-white px-2 py-0.5 rounded-lg" style={{ background: 'var(--royal)' }}>
                    {t('{{n}} ta', { n: p.quantity })}
                  </span>
                  {p.carrier_number ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-lg" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>
                      {t('Yo\'lovchi #{{number}}', { number: p.carrier_number })}
                    </span>
                  ) : (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-lg" style={{ background: '#FEF1E0', color: 'var(--amber-d)' }}>
                      {t('Buyurtmasiz')}
                    </span>
                  )}
                  {p.picked_up_at && (
                    <span className="text-[11px]" style={{ color: 'var(--muted2)' }}>{p.picked_up_at}</span>
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
