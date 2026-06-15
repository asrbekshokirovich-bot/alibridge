import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import client from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { Header, ListSkeleton, EmptyState, StatusBadge, Button, IconCheck } from '@/shared/ui'

interface Dispute {
  id: number; product_name: string; barcode: string
  carrier_name: string; carrier_number: number
  note: string; status: 'open' | 'resolved' | 'rejected'; created_at: string
}

export default function Disputes() {
  const { t } = useTranslation()
  const { notify } = useTelegram()
  const qc = useQueryClient()

  const map = {
    open: { text: t('Ochiq'), tone: 'yellow' as const },
    resolved: { text: t('Hal qilindi'), tone: 'green' as const },
    rejected: { text: t('Rad etildi'), tone: 'gray' as const },
  }

  const { data, isLoading } = useQuery({
    queryKey: ['warehouse-uz-disputes'],
    queryFn: () => client.get<Dispute[]>('/admin/disputes').then((r) => r.data),
  })

  const update = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'resolved' | 'rejected' }) =>
      client.post(`/admin/disputes/${id}/update`, { status }),
    onSuccess: () => { notify('success'); qc.invalidateQueries({ queryKey: ['warehouse-uz-disputes'] }) },
  })

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title={t('Nizolar')} subtitle={t('Shikast holatlari')} showBack />

      {isLoading ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState icon={<IconCheck size={30} />} title={t("Nizo yo'q")} description={t('Hamma narsa joyida')} />
      ) : (
        <div className="px-4 pt-4 space-y-3 web-grid">
          {data.map((d) => (
            <div key={d.id} className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
              <div className="bg-red-50/60 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚠️</span>
                  <span className="font-bold text-slate-900">{d.product_name}</span>
                </div>
                <StatusBadge tone={map[d.status].tone} dot>{map[d.status].text}</StatusBadge>
              </div>
              <div className="p-4 space-y-1.5">
                <p className="text-sm text-slate-600">{t("Yo'lovchi #{{number}} — {{name}}", { number: d.carrier_number, name: d.carrier_name })}</p>
                <p className="text-xs font-mono text-slate-400">{d.barcode}</p>
                {d.note && <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-2.5 mt-1">{d.note}</p>}

                {d.status === 'open' && (
                  <div className="flex gap-2 pt-2">
                    <Button variant="success" fullWidth onClick={() => update.mutate({ id: d.id, status: 'resolved' })}>
                      {t('Hal qilindi')}
                    </Button>
                    <Button variant="ghost" fullWidth onClick={() => update.mutate({ id: d.id, status: 'rejected' })}>
                      {t('Rad etish')}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
