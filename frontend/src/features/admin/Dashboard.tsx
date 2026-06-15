import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import client from '@/shared/api/client'
import { ActionGrid, IconUsers, IconPlane, IconAlert, IconMoney, IconUser, IconList } from '@/shared/ui'
import type { Action } from '@/shared/ui'

interface AdminStats {
  pending_staff: number; active_carriers: number; total_products: number
  open_disputes: number; unpaid_payments: number
}

const DARK = 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'

export default function AdminDashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => client.get<AdminStats>('/admin/stats').then((r) => r.data),
  })

  const actions: Action[] = [
    { label: t('Xodim so\'rovlari'), desc: t('Rol tayinlash'), path: '/admin/staff-approval', icon: <IconUsers size={24} />, gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', badge: stats?.pending_staff },
    { label: t('Xodimlar'), desc: t('Barcha xodimlar'), path: '/admin/staff', icon: <IconUsers size={24} />, gradient: 'linear-gradient(135deg, #64748b 0%, #475569 100%)' },
    { label: t('Yo\'lovchilar'), desc: t('Boshqaruv'), path: '/admin/carriers', icon: <IconPlane size={24} />, gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' },
    { label: t('Nizolar'), desc: t('Shikast holatlari'), path: '/admin/disputes', icon: <IconAlert size={24} />, gradient: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)', badge: stats?.open_disputes },
    { label: t('To\'lovlar'), desc: t('Hisobot'), path: '/admin/payments', icon: <IconMoney size={24} />, gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', badge: stats?.unpaid_payments },
    { label: t('Kunlik hisobot'), desc: t('Ombordan chiqqan yuklar'), path: '/admin/daily-report', icon: <IconList size={24} />, gradient: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)' },
    { label: t('Rol sifatida ko\'rish'), desc: t('Istalgan panelni ochish'), path: '/admin/view-as', icon: <IconUser size={24} />, gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' },
    { label: t('Sayt logini'), desc: t('Brauzer orqali kirish'), path: '/admin/my-credentials', icon: <IconUser size={24} />, gradient: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)' },
  ]

  return (
    <div className="min-h-screen animate-fade-in">
      <div className="px-5 pt-12 pb-8 text-white" style={{ background: DARK }}>
        <p className="text-sm text-white/60">{t('Administrator')}</p>
        <h1 className="text-2xl font-extrabold">{t('Boshqaruv paneli')}</h1>
      </div>

      {/* Stats — bosiladigan */}
      <div className="px-4 -mt-5">
        <div className="bg-white rounded-3xl shadow-[var(--shadow-md)] p-5 grid grid-cols-2 gap-5">
          <button onClick={() => navigate('/admin/products')} className="press text-center border-r border-slate-100">
            <p className="text-3xl font-extrabold" style={{ color: 'var(--brand)' }}>{stats?.total_products ?? 0}</p>
            <p className="text-xs text-slate-400 mt-0.5">{t('Jami mahsulot ›')}</p>
          </button>
          <button onClick={() => navigate('/admin/carriers')} className="press text-center">
            <p className="text-3xl font-extrabold text-emerald-500">{stats?.active_carriers ?? 0}</p>
            <p className="text-xs text-slate-400 mt-0.5">{t('Faol yo\'lovchi ›')}</p>
          </button>
        </div>
      </div>

      <ActionGrid actions={actions} />
    </div>
  )
}
