import { useQuery } from '@tanstack/react-query'
import client from '@/shared/api/client'
import { ActionGrid, IconUsers, IconPlane, IconAlert, IconMoney } from '@/shared/ui'
import type { Action } from '@/shared/ui'

interface AdminStats {
  pending_staff: number; active_carriers: number; total_products: number
  open_disputes: number; unpaid_payments: number
}

const DARK = 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => client.get<AdminStats>('/admin/stats').then((r) => r.data),
  })

  const actions: Action[] = [
    { label: 'Xodim so\'rovlari', desc: 'Rol tayinlash', path: '/admin/staff-approval', icon: <IconUsers size={24} />, gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', badge: stats?.pending_staff },
    { label: 'Yo\'lovchilar', desc: 'Boshqaruv', path: '/admin/carriers', icon: <IconPlane size={24} />, gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' },
    { label: 'Nizolar', desc: 'Shikast holatlari', path: '/admin/disputes', icon: <IconAlert size={24} />, gradient: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)', badge: stats?.open_disputes },
    { label: 'To\'lovlar', desc: 'Hisobot', path: '/admin/payments', icon: <IconMoney size={24} />, gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', badge: stats?.unpaid_payments },
  ]

  return (
    <div className="min-h-screen animate-fade-in">
      <div className="px-5 pt-12 pb-8 text-white" style={{ background: DARK }}>
        <p className="text-sm text-white/60">Administrator</p>
        <h1 className="text-2xl font-extrabold">Boshqaruv paneli</h1>
      </div>

      {/* Stats */}
      <div className="px-4 -mt-5">
        <div className="bg-white rounded-3xl shadow-[var(--shadow-md)] p-5 grid grid-cols-2 gap-5">
          <div className="text-center border-r border-slate-100">
            <p className="text-3xl font-extrabold" style={{ color: 'var(--brand)' }}>{stats?.total_products ?? 0}</p>
            <p className="text-xs text-slate-400 mt-0.5">Jami mahsulot</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-extrabold text-emerald-500">{stats?.active_carriers ?? 0}</p>
            <p className="text-xs text-slate-400 mt-0.5">Faol yo'lovchi</p>
          </div>
        </div>
      </div>

      <ActionGrid actions={actions} />
    </div>
  )
}
