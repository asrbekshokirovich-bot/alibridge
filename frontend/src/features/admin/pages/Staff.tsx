import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { initials } from '@/shared/lib/format'
import type { Role } from '@/shared/types'
import { Header, ListSkeleton, EmptyState, StatusBadge, IconUsers } from '@/shared/ui'

interface StaffMember {
  id: number; first_name: string; last_name: string; phone: string
  role: Role; is_active: boolean; username?: string | null
}

const ROLES: { key: Role; label: string }[] = [
  { key: 'warehouse_uz', label: 'Toshkent ombori' },
  { key: 'warehouse_tr', label: 'Turkiya ombori' },
  { key: 'courier_uz', label: 'Toshkent kuryeri' },
  { key: 'courier_tr', label: 'Turkiya kuryeri' },
  { key: 'china_worker', label: 'Xitoy ishchisi' },
]

const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLES.map((r) => [r.key, r.label]),
)

export default function Staff() {
  const { notify } = useTelegram()
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState<number | null>(null)
  // Sayt logini formasi (xodim id -> {login, parol})
  const [creds, setCreds] = useState<Record<number, { username: string; password: string }>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['admin-staff'],
    queryFn: () => client.get<StaffMember[]>('/admin/staff').then((r) => r.data),
  })

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: number; role: Role }) =>
      client.post(`/admin/staff/${id}/role`, { role }),
    onSuccess: () => {
      notify('success')
      setExpanded(null)
      qc.invalidateQueries({ queryKey: ['admin-staff'] })
    },
    onError: (err) => { alert(extractErrorMessage(err)); notify('error') },
  })

  const remove = useMutation({
    mutationFn: (id: number) => client.post(`/admin/staff/${id}/remove`),
    onSuccess: () => {
      notify('success')
      setExpanded(null)
      qc.invalidateQueries({ queryKey: ['admin-staff'] })
    },
    onError: (err) => { alert(extractErrorMessage(err)); notify('error') },
  })

  const setLogin = useMutation({
    mutationFn: ({ id, username, password }: { id: number; username: string; password: string }) =>
      client.post(`/admin/staff/${id}/credentials`, { username, password }),
    onSuccess: (_d, v) => {
      notify('success')
      setCreds((c) => ({ ...c, [v.id]: { username: '', password: '' } }))
      qc.invalidateQueries({ queryKey: ['admin-staff'] })
    },
    onError: (err) => { alert(extractErrorMessage(err)); notify('error') },
  })

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title="Xodimlar" subtitle="Barcha xodimlar" showBack />

      {isLoading ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState icon={<IconUsers size={30} />} title="Xodim yo'q" description="Tasdiqlangan xodim mavjud emas" />
      ) : (
        <div className="px-4 pt-4 space-y-3">
          {data.map((s) => {
            const open = expanded === s.id
            const busy =
              (changeRole.isPending && changeRole.variables?.id === s.id) ||
              (remove.isPending && remove.variables === s.id)
            return (
              <div key={s.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <button onClick={() => setExpanded(open ? null : s.id)}
                  className="w-full p-4 flex items-center gap-3.5 text-left">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)' }}>
                    {initials(s.first_name, s.last_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 truncate">{s.first_name} {s.last_name}</p>
                    <p className="text-xs text-slate-400">{s.phone}</p>
                    <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--brand)' }}>
                      {ROLE_LABELS[s.role] ?? s.role}
                    </p>
                  </div>
                  <StatusBadge tone={s.is_active ? 'green' : 'gray'} dot>
                    {s.is_active ? 'Faol' : 'Nofaol'}
                  </StatusBadge>
                </button>

                {open && (
                  <div className="px-4 pb-4 animate-fade-in">
                    <p className="text-xs font-medium text-slate-500 mb-2">Rolni almashtirish:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {ROLES.map((r) => {
                        const current = r.key === s.role
                        const picking = changeRole.isPending && changeRole.variables?.id === s.id && changeRole.variables?.role === r.key
                        return (
                          <button key={r.key}
                            onClick={() => !current && changeRole.mutate({ id: s.id, role: r.key })}
                            disabled={busy || current}
                            className={`press py-2.5 px-3 rounded-xl text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                              current ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-700'
                            }`}>
                            {picking && (
                              <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
                            )}
                            {r.label}
                          </button>
                        )
                      })}
                    </div>
                    {/* Sayt (brauzer) orqali kirish — login + parol */}
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs font-medium text-slate-500 mb-2">
                        Sayt logini {s.username && <span className="text-emerald-600">(joriy: {s.username})</span>}
                      </p>
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          placeholder="Login"
                          value={creds[s.id]?.username ?? ''}
                          onChange={(e) => setCreds((c) => ({ ...c, [s.id]: { username: e.target.value, password: c[s.id]?.password ?? '' } }))}
                          className="bg-slate-50 rounded-xl px-3 py-2.5 text-sm border border-slate-200 outline-none focus:border-slate-400"
                        />
                        <input
                          type="text"
                          placeholder="Parol"
                          value={creds[s.id]?.password ?? ''}
                          onChange={(e) => setCreds((c) => ({ ...c, [s.id]: { username: c[s.id]?.username ?? '', password: e.target.value } }))}
                          className="bg-slate-50 rounded-xl px-3 py-2.5 text-sm border border-slate-200 outline-none focus:border-slate-400"
                        />
                        <button
                          onClick={() => {
                            const v = creds[s.id]
                            if (!v || v.username.trim().length < 3 || v.password.length < 4) {
                              alert('Login kamida 3, parol kamida 4 belgi bo\'lsin'); return
                            }
                            setLogin.mutate({ id: s.id, username: v.username.trim(), password: v.password })
                          }}
                          disabled={setLogin.isPending && setLogin.variables?.id === s.id}
                          className="press py-2.5 rounded-xl text-xs font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
                          style={{ background: 'var(--brand-gradient)' }}>
                          {setLogin.isPending && setLogin.variables?.id === s.id && (
                            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          )}
                          {s.username ? 'Loginni yangilash' : 'Login o\'rnatish'}
                        </button>
                      </div>
                    </div>

                    <button onClick={() => {
                        if (confirm(`${s.first_name} xodimlikdan olib tashlanadimi?`)) remove.mutate(s.id)
                      }}
                      disabled={busy}
                      className="press w-full mt-2 py-2.5 bg-red-50 text-red-600 rounded-xl text-xs font-semibold disabled:opacity-50">
                      Roldan olib tashlash
                    </button>
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
