import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import type { Role } from '@/shared/types'
import { Header, ListSkeleton, EmptyState, IconUsers, IconUser } from '@/shared/ui'

interface StaffRequest {
  id: number; first_name: string; last_name: string; phone: string; created_at: string
}

export default function StaffApproval() {
  const { t } = useTranslation()
  const ROLES: { key: Role; label: string }[] = [
    { key: 'warehouse_uz', label: t('Toshkent ombori') },
    { key: 'warehouse_tr', label: t('Turkiya ombori') },
    { key: 'courier_uz', label: t('Toshkent kuryeri') },
    { key: 'courier_tr', label: t('Turkiya kuryeri') },
    { key: 'china_worker', label: t('Xitoy ishchisi') },
  ]
  const { notify } = useTelegram()
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState<number | null>(null)
  // Tasdiqlangan so'rovlar: id -> tanlangan rol (yashil ko'rsatish uchun)
  const [approvedRole, setApprovedRole] = useState<Record<number, Role>>({})

  const { data: requests, isLoading } = useQuery({
    queryKey: ['staff-requests'],
    queryFn: () => client.get<StaffRequest[]>('/admin/staff-requests').then((r) => r.data),
  })

  const approve = useMutation({
    mutationFn: ({ id, role }: { id: number; role: Role }) =>
      client.post(`/admin/staff-requests/${id}/approve`, { role }),
    onSuccess: (_data, { id, role }) => {
      notify('success')
      // Tanlangan rolni yashil ko'rsatamiz
      setApprovedRole((prev) => ({ ...prev, [id]: role }))
      // 1.5s dan keyin ro'yxatni yangilaymiz (yashil ko'rinib qolsin)
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['staff-requests'] })
        setApprovedRole((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
      }, 1500)
    },
    onError: (err) => { alert(extractErrorMessage(err)); notify('error') },
  })

  const reject = useMutation({
    mutationFn: (id: number) => client.post(`/admin/staff-requests/${id}/reject`),
    onSuccess: () => { notify('success'); qc.invalidateQueries({ queryKey: ['staff-requests'] }) },
  })

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title={t("Xodim so'rovlari")} subtitle={t('Rol tayinlang')} showBack />

      {isLoading ? (
        <ListSkeleton />
      ) : !requests?.length ? (
        <EmptyState icon={<IconUsers size={30} />} title={t("So'rov yo'q")} description={t('Yangi xodim so\'rovi mavjud emas')} />
      ) : (
        <div className="px-4 pt-4 space-y-3 web-grid">
          {requests.map((req) => {
            const open = expanded === req.id
            const done = approvedRole[req.id]
            return (
              <div key={req.id} className="rounded-2xl border overflow-hidden transition-colors"
                style={done
                  ? { background: 'rgba(52,211,153,0.10)', borderColor: 'rgba(52,211,153,0.30)', boxShadow: 'var(--shadow-md)' }
                  : { background: 'var(--surface)', borderColor: 'var(--line)', boxShadow: 'var(--shadow-md)' }}>
                <button onClick={() => setExpanded(open ? null : req.id)}
                  className="w-full p-4 flex items-center gap-3 text-left">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: done ? 'linear-gradient(135deg, #34d399, #16A34A)' : 'var(--brand-gradient)' }}>
                    <IconUser size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[14.5px]" style={{ color: 'var(--ink)' }}>{req.first_name} {req.last_name}</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      {done ? ROLES.find((r) => r.key === done)?.label : req.phone}
                    </p>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={`transition-transform ${open ? 'rotate-90' : ''}`} style={{ color: 'var(--muted3)' }}>
                    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {open && (
                  <div className="px-4 pb-4 animate-fade-in">
                    {approvedRole[req.id] ? (
                      // Tasdiqlandi — tanlangan vazifa yashil
                      <div className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold" style={{ background: 'rgba(52,211,153,0.14)', color: 'var(--green)' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {t('{{role}} — tayinlandi', { role: ROLES.find((r) => r.key === approvedRole[req.id])?.label })}
                      </div>
                    ) : (
                      <>
                        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>{t('Vazifa tanlang:')}</p>
                        <div className="grid grid-cols-2 gap-2">
                          {ROLES.map((r) => {
                            const isPicking =
                              approve.isPending && approve.variables?.id === req.id && approve.variables?.role === r.key
                            return (
                              <button key={r.key} onClick={() => approve.mutate({ id: req.id, role: r.key })}
                                disabled={approve.isPending}
                                className="press py-2.5 px-3 rounded-xl text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5 border"
                                style={isPicking
                                  ? { background: 'rgba(52,211,153,0.14)', color: 'var(--green)', borderColor: 'rgba(52,211,153,0.30)' }
                                  : { background: 'var(--surface2)', color: 'var(--ink)', borderColor: 'var(--line2)' }}>
                                {isPicking && (
                                  <span className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(22,163,74,0.4)', borderTopColor: 'var(--green)' }} />
                                )}
                                {r.label}
                              </button>
                            )
                          })}
                        </div>
                        <button onClick={() => reject.mutate(req.id)}
                          className="press w-full mt-2 py-2.5 rounded-xl text-xs font-semibold"
                          style={{ background: 'rgba(239,68,68,0.10)', color: 'var(--red)' }}>
                          {t('Rad etish')}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
