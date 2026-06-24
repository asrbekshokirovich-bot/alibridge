import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useAuthStore } from '@/shared/store/auth'
import { useCarrierStore } from '../store'
import { initials } from '@/shared/lib/format'
import { Header, IconPlane, IconBag, IconCheck, IconChevronRight } from '@/shared/ui'
import type { User } from '@/shared/types'

export default function Profile() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const setAuth = useAuthStore((s) => s.setAuth)
  const ticket = useCarrierStore((s) => s.ticket)
  const clearTicket = useCarrierStore((s) => s.clearTicket)
  const [leaveLoading, setLeaveLoading] = useState(false)
  const [leaveError, setLeaveError] = useState('')

  const handleLeave = async () => {
    setLeaveError('')
    setLeaveLoading(true)
    try {
      const res = await client.post<{ token: string; user: User }>('/carrier/leave-role')
      clearTicket()
      setAuth(res.data.token, res.data.user)
      navigate('/welcome', { replace: true })
    } catch (err) {
      setLeaveError(extractErrorMessage(err))
    } finally {
      setLeaveLoading(false)
    }
  }

  return (
    <div className="min-h-screen pb-28 animate-fade-in">
      <Header title={t('Profil')} />

      {/* Avatar + raqam */}
      <div className="flex flex-col items-center pt-6 pb-4">
        <div className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-extrabold mb-3 shadow-[var(--shadow-brand)]"
          style={{ background: 'var(--brand-gradient)' }}>
          {initials(user?.first_name, user?.last_name)}
        </div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--ink)' }}>{user?.first_name} {user?.last_name}</h2>
        {user?.carrier_number != null && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-sm font-bold"
            style={{ background: 'var(--brand-gradient)' }}>
            {t('Raqamingiz: {{number}}', { number: user.carrier_number })}
          </div>
        )}
      </div>

      {/* Ma'lumotlar */}
      <div className="px-4 pt-2 space-y-3">
        <div className="rounded-2xl border divide-y" style={{ background: 'var(--card-gradient)', borderColor: 'var(--line2)', boxShadow: 'var(--shadow-md)' }}>
          <Row label={t('Telefon')} value={user?.phone ?? '—'} />
          <Row label={t('Rol')} value={t('Yo\'lovchi')} />
        </div>

        {/* Joriy bilet */}
        {ticket && (
          <div className="rounded-2xl border p-4" style={{ background: 'var(--card-gradient)', borderColor: 'var(--line2)', boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ background: 'var(--brand-gradient)' }}>
                <IconPlane size={16} />
              </div>
              <span className="font-bold" style={{ color: 'var(--ink)' }}>{t('Joriy reys')}</span>
            </div>
            <div className="space-y-2">
              <Row label={t('Uchish sanasi')} value={ticket.flight_date} flat />
            </div>
          </div>
        )}

        {/* Statistika (mock) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border p-4 text-center" style={{ background: 'var(--card-gradient)', borderColor: 'var(--line2)', boxShadow: 'var(--shadow-md)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ background: 'rgba(52,211,153,0.14)', color: 'var(--green)' }}>
              <IconCheck size={18} />
            </div>
            <p className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--ink)' }}>0</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('Yetkazilgan')}</p>
          </div>
          <div className="rounded-2xl border p-4 text-center" style={{ background: 'var(--card-gradient)', borderColor: 'var(--line2)', boxShadow: 'var(--shadow-md)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ background: 'rgba(106,163,255,0.14)', color: 'var(--brand-light)' }}>
              <IconBag size={18} />
            </div>
            <p className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--ink)' }}>0</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('Jami reys')}</p>
          </div>
        </div>

        {/* Roldan chiqish */}
        {leaveError && (
          <div className="text-sm px-4 py-3 rounded-2xl" style={{ background: 'rgba(239,68,68,0.10)', color: 'var(--red)' }}>{leaveError}</div>
        )}
        <button
          onClick={handleLeave}
          disabled={leaveLoading}
          className="press w-full rounded-2xl border px-4 py-3.5 flex items-center justify-between disabled:opacity-60"
          style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' }}
        >
          <span className="text-sm font-semibold" style={{ color: 'var(--red)' }}>
            {leaveLoading ? t('Tekshirilmoqda...') : t('Yo\'lovchi rolidan chiqish')}
          </span>
          <span style={{ color: 'rgba(239,68,68,0.55)' }}><IconChevronRight size={18} /></span>
        </button>
      </div>
    </div>
  )
}

function Row({ label, value, flat }: { label: string; value: string; flat?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${flat ? '' : 'px-4 py-3'}`} style={{ borderColor: 'var(--line)' }}>
      <span className="text-sm" style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{value}</span>
    </div>
  )
}
