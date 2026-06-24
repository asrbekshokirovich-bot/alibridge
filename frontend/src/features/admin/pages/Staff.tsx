import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { initials } from '@/shared/lib/format'
import type { Role } from '@/shared/types'
import { Header, ListSkeleton, EmptyState, StatusBadge, Input, Button, IconUsers } from '@/shared/ui'

interface StaffMember {
  id: number; first_name: string; last_name: string; phone: string
  role: Role; is_active: boolean; username?: string | null
}

export default function Staff() {
  const { t } = useTranslation()
  const ROLES: { key: Role; label: string }[] = [
    { key: 'warehouse_uz', label: t('Toshkent ombori') },
    { key: 'warehouse_tr', label: t('Turkiya ombori') },
    { key: 'courier_uz', label: t('Toshkent kuryeri') },
    { key: 'courier_tr', label: t('Turkiya kuryeri') },
    { key: 'china_worker', label: t('Xitoy ishchisi') },
  ]
  const ROLE_LABELS: Record<string, string> = Object.fromEntries(
    ROLES.map((r) => [r.key, r.label]),
  )
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
      <Header title={t('Xodimlar')} subtitle={t('Barcha xodimlar')} showBack />

      {isLoading ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState icon={<IconUsers size={30} />} title={t('Xodim yo\'q')} description={t('Tasdiqlangan xodim mavjud emas')} />
      ) : (
        <div className="px-4 pt-4 space-y-3 web-grid">
          {data.map((s) => {
            const open = expanded === s.id
            const busy =
              (changeRole.isPending && changeRole.variables?.id === s.id) ||
              (remove.isPending && remove.variables === s.id)
            return (
              <div key={s.id} className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card-gradient)', borderColor: 'var(--line2)', boxShadow: 'var(--shadow-md)' }}>
                <button onClick={() => setExpanded(open ? null : s.id)}
                  className="w-full p-4 flex items-center gap-3.5 text-left">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ background: 'var(--brand-gradient)' }}>
                    {initials(s.first_name, s.last_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate text-[14.5px]" style={{ color: 'var(--ink)' }}>{s.first_name} {s.last_name}</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>{s.phone}</p>
                    <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--brand-light)' }}>
                      {ROLE_LABELS[s.role] ?? s.role}
                    </p>
                  </div>
                  <StatusBadge tone={s.is_active ? 'green' : 'gray'} dot>
                    {s.is_active ? t('Faol') : t('Nofaol')}
                  </StatusBadge>
                </button>

                {open && (
                  <div className="px-4 pb-4 animate-fade-in border-t" style={{ borderColor: 'var(--line)' }}>
                    <p className="text-xs font-semibold mt-3 mb-2" style={{ color: 'var(--muted)' }}>{t('Rolni almashtirish:')}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {ROLES.map((r) => {
                        const current = r.key === s.role
                        const picking = changeRole.isPending && changeRole.variables?.id === s.id && changeRole.variables?.role === r.key
                        return (
                          <button key={r.key}
                            onClick={() => !current && changeRole.mutate({ id: s.id, role: r.key })}
                            disabled={busy || current}
                            className="press py-2.5 px-3 rounded-xl text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5 border"
                            style={current
                              ? { background: 'rgba(106,163,255,0.14)', color: 'var(--brand-light)', borderColor: 'rgba(106,163,255,0.30)' }
                              : { background: 'var(--surface2)', color: 'var(--ink)', borderColor: 'var(--line2)' }}>
                            {picking && (
                              <span className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--line2)', borderTopColor: 'var(--brand-light)' }} />
                            )}
                            {r.label}
                          </button>
                        )
                      })}
                    </div>
                    {/* Sayt (brauzer) orqali kirish — login + parol */}
                    <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--line)' }}>
                      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>
                        {t('Sayt logini')} {s.username && <span style={{ color: 'var(--green)' }}>{t('(joriy: {{username}})', { username: s.username })}</span>}
                      </p>
                      <div className="flex flex-col gap-2">
                        <Input
                          type="text"
                          placeholder={t('Login')}
                          value={creds[s.id]?.username ?? ''}
                          onChange={(e) => setCreds((c) => ({ ...c, [s.id]: { username: e.target.value, password: c[s.id]?.password ?? '' } }))}
                          className="!h-11 !text-sm"
                        />
                        <Input
                          type="text"
                          placeholder={t('Parol')}
                          value={creds[s.id]?.password ?? ''}
                          onChange={(e) => setCreds((c) => ({ ...c, [s.id]: { username: c[s.id]?.username ?? '', password: e.target.value } }))}
                          className="!h-11 !text-sm"
                        />
                        <Button
                          variant="primary"
                          fullWidth
                          loading={setLogin.isPending && setLogin.variables?.id === s.id}
                          onClick={() => {
                            const v = creds[s.id]
                            if (!v || v.username.trim().length < 3 || v.password.length < 4) {
                              alert(t('Login kamida 3, parol kamida 4 belgi bo\'lsin')); return
                            }
                            setLogin.mutate({ id: s.id, username: v.username.trim(), password: v.password })
                          }}
                          className="!h-11 !text-xs">
                          {s.username ? t('Loginni yangilash') : t('Login o\'rnatish')}
                        </Button>
                      </div>
                    </div>

                    <button onClick={() => {
                        if (confirm(t('{{name}} xodimlikdan olib tashlanadimi?', { name: s.first_name }))) remove.mutate(s.id)
                      }}
                      disabled={busy}
                      className="press w-full mt-2 py-2.5 rounded-xl text-xs font-semibold disabled:opacity-50"
                      style={{ background: 'rgba(239,68,68,0.10)', color: 'var(--red)' }}>
                      {t('Roldan olib tashlash')}
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
