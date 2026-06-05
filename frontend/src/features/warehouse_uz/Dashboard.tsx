import { useQuery } from '@tanstack/react-query'
import client from '@/shared/api/client'
import { useAuthStore } from '@/shared/store/auth'
import { DashboardHeader, ActionGrid, IconPackagePlus, IconScan, IconPlane, IconTruck } from '@/shared/ui'
import type { Action } from '@/shared/ui'

interface Stats { pending_receive: number; in_warehouse: number; pending_handover: number }

export default function WarehouseUzDashboard() {
  const user = useAuthStore((s) => s.user)

  const { data: stats } = useQuery({
    queryKey: ['warehouse-uz-stats'],
    queryFn: () => client.get<Stats>('/warehouse-uz/stats').then((r) => r.data),
  })

  const actions: Action[] = [
    { label: 'Yuk qabul qilish', desc: 'Xitoydan kelgan yuk', path: '/warehouse-uz/receive', icon: <IconPackagePlus size={24} />, gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
    { label: 'Tortish va barkod', desc: 'Kiloli yukni tayyorlash', path: '/warehouse-uz/weigh', icon: <IconScan size={24} />, gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', badge: stats?.pending_handover },
    { label: 'Yo\'lovchiga topshirish', desc: 'Barkod skanlab berish', path: '/warehouse-uz/handover-carrier', icon: <IconPlane size={24} />, gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' },
    { label: 'Kuryerga topshirish', desc: 'Toshkent kuryeriga', path: '/warehouse-uz/handover-courier', icon: <IconTruck size={24} />, gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' },
  ]

  return (
    <div className="min-h-screen animate-fade-in">
      <DashboardHeader role="Toshkent ombori" name={user?.first_name} />

      {/* Stats */}
      <div className="px-4 -mt-4">
        <div className="bg-white rounded-3xl shadow-[var(--shadow-md)] p-4 grid grid-cols-2 gap-4">
          <div className="text-center border-r border-slate-100">
            <p className="text-3xl font-extrabold text-amber-500">{stats?.pending_receive ?? 0}</p>
            <p className="text-xs text-slate-400 mt-0.5">Kutilayotgan</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-extrabold" style={{ color: 'var(--brand)' }}>{stats?.in_warehouse ?? 0}</p>
            <p className="text-xs text-slate-400 mt-0.5">Omborда</p>
          </div>
        </div>
      </div>

      <ActionGrid actions={actions} />
    </div>
  )
}
