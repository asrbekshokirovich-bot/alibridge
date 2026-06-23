import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import client from '@/shared/api/client'
import { DashboardHeader, ActionSections, IconUsers, IconPlane, IconAlert, IconMoney, IconUser, IconList, IconBox } from '@/shared/ui'
import type { ActionSection } from '@/shared/ui'

interface AdminStats {
  pending_staff: number; active_carriers: number; total_products: number
  open_disputes: number; unpaid_payments: number
}

export default function AdminDashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => client.get<AdminStats>('/admin/stats').then((r) => r.data),
  })

  // Workflow tartibida bo'limlar: Boshqaruv → Moliya → Hisobot → Tizim
  const sections: ActionSection[] = [
    { title: t('Boshqaruv'), actions: [
      { label: t('Xodim so\'rovlari'), desc: t('Rol tayinlash'), path: '/admin/staff-approval', icon: <IconUsers size={24} />, gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', badge: stats?.pending_staff },
      { label: t('Xodimlar'), desc: t('Barcha xodimlar'), path: '/admin/staff', icon: <IconUsers size={24} />, gradient: 'linear-gradient(135deg, #1A3A6C 0%, #132A4D 100%)' },
      { label: t('Yo\'lovchilar'), desc: t('Boshqaruv'), path: '/admin/carriers', icon: <IconPlane size={24} />, gradient: 'linear-gradient(135deg, #1A3A6C 0%, #16325c 100%)' },
    ] },
    { title: t('Moliya'), actions: [
      { label: t('To\'lovlar'), desc: t('Hisobot'), path: '/admin/payments', icon: <IconMoney size={24} />, gradient: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)', badge: stats?.unpaid_payments },
    ] },
    { title: t('Hisobot'), actions: [
      { label: t('Kunlik hisobot'), desc: t('Ombordan chiqqan yuklar'), path: '/admin/daily-report', icon: <IconList size={24} />, gradient: 'linear-gradient(135deg, #1A3A6C 0%, #0F213D 100%)' },
      { label: t('Nizolar'), desc: t('Shikast holatlari'), path: '/admin/disputes', icon: <IconAlert size={24} />, gradient: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)', badge: stats?.open_disputes },
    ] },
    { title: t('Tizim'), actions: [
      { label: t('Rol sifatida ko\'rish'), desc: t('Istalgan panelni ochish'), path: '/admin/view-as', icon: <IconUser size={24} />, gradient: 'linear-gradient(135deg, #132A4D 0%, #0F213D 100%)' },
      { label: t('Sayt logini'), desc: t('Brauzer orqali kirish'), path: '/admin/my-credentials', icon: <IconUser size={24} />, gradient: 'linear-gradient(135deg, #1A3A6C 0%, #132A4D 100%)' },
    ] },
  ]

  return (
    <div className="min-h-screen animate-fade-in" style={{ background: 'var(--bg)' }}>
      <DashboardHeader role={t('Administrator')} name={t('Boshqaruv paneli')} />

      {/* Stats — bosiladigan (hero ustiga biroz "overlap") */}
      <div className="px-4 -mt-7 relative z-10">
        <div className="grid grid-cols-2 gap-3.5">
          <button
            onClick={() => navigate('/admin/products')}
            className="ab-card text-left p-4 cursor-pointer"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center" style={{ background: '#EBF1FA', color: 'var(--royal)' }}>
                <IconBox size={18} />
              </span>
              <span className="text-[10.5px] font-bold uppercase tracking-[0.05em]" style={{ color: 'var(--muted2)' }}>{t('Jami mahsulot')}</span>
            </div>
            <p className="text-[26px] font-extrabold leading-none tabular-nums" style={{ color: 'var(--royal)' }}>{stats?.total_products ?? 0}</p>
          </button>

          <button
            onClick={() => navigate('/admin/carriers')}
            className="ab-card text-left p-4 cursor-pointer"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center" style={{ background: '#E9F6EE', color: 'var(--green)' }}>
                <IconPlane size={18} />
              </span>
              <span className="text-[10.5px] font-bold uppercase tracking-[0.05em]" style={{ color: 'var(--muted2)' }}>{t('Faol yo\'lovchi')}</span>
            </div>
            <p className="text-[26px] font-extrabold leading-none tabular-nums" style={{ color: 'var(--ink)' }}>{stats?.active_carriers ?? 0}</p>
          </button>
        </div>
      </div>

      <ActionSections sections={sections} />
    </div>
  )
}
