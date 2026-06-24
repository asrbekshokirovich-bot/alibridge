import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { useAuthStore } from '@/shared/store/auth'
import { initials } from '@/shared/lib/format'
import { Header, ListSkeleton, EmptyState, StatusBadge, IconPlane, IconTrash } from '@/shared/ui'

interface Carrier {
  id: number; first_name: string; last_name: string; phone: string
  carrier_number: number; is_active: boolean; total_trips: number; has_cargo: boolean
}

export default function Carriers() {
  const { t } = useTranslation()
  const { notify } = useTelegram()
  const qc = useQueryClient()
  const isAdmin = useAuthStore((s) => s.user?.role) === 'admin'

  const { data, isLoading } = useQuery({
    queryKey: ['admin-carriers'],
    queryFn: () => client.get<Carrier[]>('/admin/carriers').then((r) => r.data),
  })

  const remove = useMutation({
    mutationFn: (id: number) => client.post(`/admin/carriers/${id}/remove`),
    onSuccess: () => {
      notify('success')
      qc.invalidateQueries({ queryKey: ['admin-carriers'] })
    },
    onError: (err) => { alert(extractErrorMessage(err)); notify('error') },
  })

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title={t("Yo'lovchilar")} subtitle={t('Barcha yo\'lovchilar')} showBack />

      {isLoading ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState icon={<IconPlane size={30} />} title={t("Yo'lovchi yo'q")} />
      ) : (
        <div className="px-4 pt-4 space-y-3 web-grid">
          {data.map((c) => {
            const busy = remove.isPending && remove.variables === c.id
            return (
              <div key={c.id} className="rounded-2xl p-4 border flex items-center gap-3.5" style={{ background: 'var(--card-gradient)', borderColor: 'var(--line2)', boxShadow: 'var(--shadow-md)' }}>
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold" style={{ background: 'var(--brand-gradient)' }}>
                    {initials(c.first_name, c.last_name)}
                  </div>
                  <span className="absolute -bottom-1 -right-1 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--royal)' }}>
                    #{c.carrier_number}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate text-[14.5px]" style={{ color: 'var(--ink)' }}>{c.first_name} {c.last_name}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{c.phone}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted2)' }}>{t('Jami reys: {{count}}', { count: c.total_trips })}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <StatusBadge tone={c.has_cargo ? 'green' : 'red'} dot>
                    {c.has_cargo ? t('Yuk bor') : t('Yuk yo\'q')}
                  </StatusBadge>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        if (confirm(t("{{name}} yo'lovchi rolidan olib tashlansinmi?", { name: c.first_name }))) remove.mutate(c.id)
                      }}
                      disabled={busy || c.has_cargo}
                      title={c.has_cargo ? t('Yuk bor — avval topshirilishi kerak') : t('Roldan olib tashlash')}
                      className="press flex items-center gap-1 text-xs font-semibold disabled:opacity-40"
                      style={{ color: 'var(--red)' }}
                    >
                      {busy ? (
                        <span className="w-3 h-3 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
                      ) : (
                        <IconTrash size={14} />
                      )}
                      {t("O'chirish")}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
