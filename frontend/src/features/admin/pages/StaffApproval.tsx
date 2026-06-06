import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import type { Role } from '@/shared/types'
import { Header, ListSkeleton, EmptyState, IconUsers, IconUser } from '@/shared/ui'

interface StaffRequest {
  id: number; first_name: string; last_name: string; phone: string; created_at: string
}

const ROLES: { key: Role; label: string }[] = [
  { key: 'warehouse_uz', label: 'Toshkent ombori' },
  { key: 'warehouse_tr', label: 'Turkiya ombori' },
  { key: 'courier_uz', label: 'Toshkent kuryeri' },
  { key: 'courier_tr', label: 'Turkiya kuryeri' },
  { key: 'china_worker', label: 'Xitoy ishchisi' },
]

export default function StaffApproval() {
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
      <Header title="Xodim so'rovlari" subtitle="Rol tayinlang" showBack />

      {isLoading ? (
        <ListSkeleton />
      ) : !requests?.length ? (
        <EmptyState icon={<IconUsers size={30} />} title="So'rov yo'q" description="Yangi xodim so'rovi mavjud emas" />
      ) : (
        <div className="px-4 pt-4 space-y-3">
          {requests.map((req) => {
            const open = expanded === req.id
            const done = approvedRole[req.id]
            return (
              <div key={req.id} className={`rounded-2xl border shadow-sm overflow-hidden transition-colors ${done ? 'bg-emerald-50/40 border-emerald-200' : 'bg-white border-slate-100'}`}>
                <button onClick={() => setExpanded(open ? null : req.id)}
                  className="w-full p-4 flex items-center gap-3 text-left">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: done ? 'linear-gradient(135deg, #34d399, #10b981)' : 'linear-gradient(135deg, #94a3b8, #64748b)' }}>
                    <IconUser size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900">{req.first_name} {req.last_name}</p>
                    <p className="text-xs text-slate-400">
                      {done ? ROLES.find((r) => r.key === done)?.label : req.phone}
                    </p>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={`text-slate-300 transition-transform ${open ? 'rotate-90' : ''}`}>
                    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {open && (
                  <div className="px-4 pb-4 animate-fade-in">
                    {approvedRole[req.id] ? (
                      // Tasdiqlandi — tanlangan vazifa yashil
                      <div className="flex items-center justify-center gap-2 py-3 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-bold">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {ROLES.find((r) => r.key === approvedRole[req.id])?.label} — tayinlandi
                      </div>
                    ) : (
                      <>
                        <p className="text-xs font-medium text-slate-500 mb-2">Vazifa tanlang:</p>
                        <div className="grid grid-cols-2 gap-2">
                          {ROLES.map((r) => {
                            const isPicking =
                              approve.isPending && approve.variables?.id === req.id && approve.variables?.role === r.key
                            return (
                              <button key={r.key} onClick={() => approve.mutate({ id: req.id, role: r.key })}
                                disabled={approve.isPending}
                                className={`press py-2.5 px-3 rounded-xl text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                                  isPicking ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                                }`}>
                                {isPicking && (
                                  <span className="w-3 h-3 border-2 border-emerald-400/40 border-t-emerald-500 rounded-full animate-spin" />
                                )}
                                {r.label}
                              </button>
                            )
                          })}
                        </div>
                        <button onClick={() => reject.mutate(req.id)}
                          className="press w-full mt-2 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold">
                          Rad etish
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
