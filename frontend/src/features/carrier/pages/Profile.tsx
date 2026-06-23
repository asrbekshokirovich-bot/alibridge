import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useAuthStore } from '@/shared/store/auth'
import { useCarrierStore } from '../store'
import { initials } from '@/shared/lib/format'
import { IconPlane, IconCard, IconAlert, IconChevronRight } from '@/shared/ui'
import type { User } from '@/shared/types'

// Ishonch limiti (kg). Hozircha qat'iy — keyin backenddan keladi.
const WEIGHT_LIMIT_KG = 20

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
    <div className="min-h-screen pb-32 animate-fade-in">
      {/* Profil sarlavhasi */}
      <div className="flex flex-col items-center pt-7 pb-4">
        <div className="w-[88px] h-[88px] rounded-full flex items-center justify-center text-3xl font-extrabold mb-3.5 border"
          style={{ background: 'linear-gradient(150deg,#3a3a44,#1a1a1f)', borderColor: 'var(--border-strong)', color: 'var(--text)', boxShadow: '0 18px 40px -16px rgba(0,0,0,0.8)' }}>
          {initials(user?.first_name, user?.last_name)}
        </div>
        <h2 className="text-[21px] font-extrabold tracking-[-0.01em]" style={{ color: 'var(--text)' }}>{user?.first_name} {user?.last_name}</h2>
        <div className="flex items-center gap-2 mt-2.5">
          {user?.carrier_number != null && (
            <span className="text-[12.5px] font-bold px-3 py-1 rounded-full border whitespace-nowrap"
              style={{ color: 'var(--brand-light)', background: 'var(--brand-tint)', borderColor: 'var(--brand-tint-border)' }}>
              {t("Yo'lovchi")} #{user.carrier_number}
            </span>
          )}
          {user?.phone && (
            <span className="text-[12.5px] font-semibold px-3 py-1 rounded-full border"
              style={{ color: 'var(--text-2)', background: 'var(--card-2)', borderColor: 'var(--border-chip)' }}>
              {user.phone}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 space-y-3.5">
        {/* Ishonch / sig'im */}
        <div className="rounded-[20px] border p-4" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}>
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-[12.5px] font-semibold" style={{ color: 'var(--text-muted)' }}>{t('Ishonch limiti')}</span>
            <span className="text-sm font-bold tabnum" style={{ color: 'var(--text)' }}>{WEIGHT_LIMIT_KG} kg / {t('reys')}</span>
          </div>
          <div className="h-[7px] rounded-md overflow-hidden" style={{ background: 'var(--border-chip)' }}>
            <div className="h-full rounded-md" style={{ width: '80%', background: 'linear-gradient(90deg,#e8c84a,#f0d878)' }} />
          </div>
          <p className="text-[11.5px] mt-3 leading-relaxed" style={{ color: 'var(--text-faint)' }}>
            {t('Har bir muvaffaqiyatli reys ishonch darajangizni oshiradi.')}
          </p>
        </div>

        {/* Joriy bilet */}
        {ticket && (
          <div className="rounded-[20px] border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-[10px] flex items-center justify-center border"
                style={{ background: 'var(--brand-tint)', borderColor: 'var(--brand-tint-border)', color: 'var(--brand-light)' }}>
                <IconPlane size={16} />
              </div>
              <span className="font-bold" style={{ color: 'var(--text)' }}>{t('Joriy reys')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('Uchish sanasi')}</span>
              <span className="text-sm font-semibold tabnum" style={{ color: 'var(--text)' }}>
                {[ticket.flight_date, ticket.flight_number].filter(Boolean).join(' · ')}
              </span>
            </div>
          </div>
        )}

        {/* Daromad statistikasi */}
        <div className="grid grid-cols-2 gap-2.5">
          <StatBox value="0" label={t('Jami daromad')} earn />
          <StatBox value="0" label={t('Yetkazilgan yuk')} />
          <StatBox value="0" label={t('Jami reys')} />
          <StatBox value="—" label={t('Reyting')} />
        </div>

        {/* Sozlama qatorlari */}
        <div className="rounded-[18px] border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <SettingRow icon={<IconCard size={19} />} label={t("To'lov ma'lumotlari")} />
          <div className="border-t" style={{ borderColor: 'var(--border-soft)' }} />
          <SettingRow icon={<IconAlert size={19} />} label={t('Nizolarim')} />
        </div>

        {/* Roldan chiqish */}
        {leaveError && (
          <div className="text-sm px-4 py-3 rounded-2xl" style={{ background: 'var(--brand-tint)', color: 'var(--brand-light)' }}>{leaveError}</div>
        )}
        <button
          onClick={handleLeave}
          disabled={leaveLoading}
          className="press w-full rounded-2xl border px-4 py-3.5 flex items-center justify-between disabled:opacity-60"
          style={{ background: 'var(--brand-tint)', borderColor: 'var(--brand-tint-border)' }}
        >
          <span className="text-sm font-semibold" style={{ color: 'var(--brand-light)' }}>
            {leaveLoading ? t('Tekshirilmoqda...') : t("Yo'lovchi rolidan chiqish")}
          </span>
          <span style={{ color: 'var(--brand)' }}><IconChevronRight size={18} /></span>
        </button>
      </div>
    </div>
  )
}

function StatBox({ value, label, earn }: { value: string; label: string; earn?: boolean }) {
  return (
    <div className="rounded-[18px] border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <p className="text-[26px] font-extrabold tracking-[-0.02em] tabnum" style={{ color: earn ? 'var(--lime)' : 'var(--text)' }}>{value}</p>
      <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  )
}

function SettingRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5">
      <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
      <span className="flex-1 text-sm font-semibold" style={{ color: 'var(--text)' }}>{label}</span>
      <span style={{ color: 'var(--text-ghost)' }}><IconChevronRight size={16} /></span>
    </div>
  )
}
