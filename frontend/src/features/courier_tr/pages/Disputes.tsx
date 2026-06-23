import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import client from '@/shared/api/client'
import { Header, ListSkeleton, EmptyState, StatusBadge, IconCheck, IconAlert } from '@/shared/ui'

interface Dispute {
  id: number; product_name: string; barcode: string
  carrier_name: string; carrier_number: number | null
  note: string; status: 'open' | 'resolved' | 'rejected'; created_at: string
}

export default function CourierTrDisputes() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const map = {
    open: { text: t('Ochiq'), tone: 'yellow' as const },
    resolved: { text: t('Hal qilindi'), tone: 'green' as const },
    rejected: { text: t('Rad etildi'), tone: 'gray' as const },
  }

  const { data, isLoading } = useQuery({
    queryKey: ['courier-tr-disputes'],
    queryFn: () => client.get<Dispute[]>('/admin/disputes').then((r) => r.data),
  })

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title={t('Zarar yetgan yuklar')} subtitle={t('Shikast holatlari')} showBack
        onBack={() => navigate('/courier-tr')} />

      {isLoading ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState icon={<IconCheck size={30} />} title={t("Nizo yo'q")} description={t('Hamma narsa joyida')} />
      ) : (
        <div className="px-4 pt-4 space-y-3 web-grid">
          {data.map((d) => (
            <div key={d.id} className="rounded-2xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'rgba(239,68,68,0.25)', boxShadow: 'var(--shadow-md)' }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(255,107,107,0.10)' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0" style={{ color: 'var(--red)' }}><IconAlert size={18} /></span>
                  <span className="font-bold truncate" style={{ color: 'var(--ink)' }}>{d.product_name || d.barcode}</span>
                </div>
                <StatusBadge tone={map[d.status].tone} dot>{map[d.status].text}</StatusBadge>
              </div>
              <div className="p-4 space-y-1.5">
                {d.carrier_number != null && (
                  <p className="text-sm" style={{ color: 'var(--ink)' }}>{t("Yo'lovchi #{{number}} — {{name}}", { number: d.carrier_number, name: d.carrier_name })}</p>
                )}
                <p className="text-xs font-mono" style={{ color: 'var(--muted2)' }}>{d.barcode}</p>
                {d.note && <p className="text-sm rounded-xl p-2.5 mt-1" style={{ background: 'var(--surface2)', color: 'var(--ink)' }}>{d.note}</p>}
                <p className="text-[11px]" style={{ color: 'var(--muted2)' }}>{d.created_at}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
