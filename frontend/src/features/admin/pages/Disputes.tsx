import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import client from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { Header, ListSkeleton, EmptyState, StatusBadge, Button, IconCheck, IconAlert } from '@/shared/ui'

interface Dispute {
  id: number; product_name: string; barcode: string
  carrier_name: string | null; carrier_number: number | null
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
    queryKey: ['admin-disputes'],
    queryFn: () => client.get<Dispute[]>('/admin/disputes').then((r) => r.data),
  })

  const update = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'resolved' | 'rejected' }) =>
      client.post(`/admin/disputes/${id}/update`, { status }),
    onSuccess: () => { notify('success'); qc.invalidateQueries({ queryKey: ['admin-disputes'] }) },
  })

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title={t('Nizolar')} subtitle={t('Shikast holatlari')} showBack />

      {isLoading ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState icon={<IconCheck size={30} />} title={t('Nizo yo\'q')} description={t('Hamma narsa joyida')} />
      ) : (
        <div className="px-4 pt-4 space-y-3 web-grid">
          {data.map((d) => (
            <div key={d.id} className="rounded-2xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'rgba(239,68,68,0.25)', boxShadow: 'var(--shadow-md)' }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(239,68,68,0.07)' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span style={{ color: 'var(--red)' }}><IconAlert size={18} /></span>
                  <span className="font-bold truncate text-[14.5px]" style={{ color: 'var(--ink)' }}>{d.product_name}</span>
                </div>
                <StatusBadge tone={map[d.status].tone} dot>{map[d.status].text}</StatusBadge>
              </div>
              <div className="p-4 space-y-1.5">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  {d.carrier_number ? t('Yo\'lovchi #{{number}}', { number: d.carrier_number }) : t('Yo\'lovchi —')}
                  {d.carrier_name ? ` — ${d.carrier_name}` : ''}
                </p>
                <p className="text-xs font-mono" style={{ color: 'var(--muted2)' }}>{d.barcode}</p>
                {d.note && <p className="text-sm rounded-xl p-2.5 mt-1" style={{ background: 'var(--surface2)', color: 'var(--ink)' }}>{d.note}</p>}

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
