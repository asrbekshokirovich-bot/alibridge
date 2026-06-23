import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/shared/store/auth'
import { initials } from '@/shared/lib/format'
import { Header, IconUser, IconChevronRight } from '@/shared/ui'

export default function OrdererProfile() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  return (
    <div className="min-h-screen pb-28 animate-fade-in">
      <Header title={t('Profil')} />

      <div className="flex flex-col items-center pt-7 pb-4">
        <div className="w-[84px] h-[84px] rounded-full flex items-center justify-center text-2xl font-extrabold mb-3.5"
          style={{ background: 'var(--brand-gradient)', color: '#fff', boxShadow: 'var(--shadow-brand)' }}>
          {initials(user?.first_name, user?.last_name)}
        </div>
        <h2 className="text-[20px] font-extrabold" style={{ color: 'var(--ink)' }}>{user?.first_name} {user?.last_name}</h2>
        <span className="mt-2 text-[12.5px] font-bold px-3 py-1 rounded-full"
          style={{ color: 'var(--lime)', background: 'rgba(212,233,76,0.12)', border: '1px solid rgba(212,233,76,0.28)' }}>
          {t('Buyurtmachi')}
        </span>
      </div>

      <div className="px-4 space-y-3">
        <div className="glass rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-md)' }}>
          <Row label={t('Telefon')} value={user?.phone ?? '—'} />
        </div>

        <button onClick={() => navigate('/welcome')}
          className="press w-full rounded-2xl px-4 py-3.5 flex items-center justify-between border"
          style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
          <span className="flex items-center gap-3 text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
            <IconUser size={18} />
            {t('Rolni almashtirish')}
          </span>
          <span style={{ color: 'var(--muted3)' }}><IconChevronRight size={18} /></span>
        </button>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span className="text-[14px]" style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>{value}</span>
    </div>
  )
}
