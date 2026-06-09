import { useQuery } from '@tanstack/react-query'
import client from '@/shared/api/client'
import { useAuthStore } from '@/shared/store/auth'
import { DashboardHeader, ActionGrid, IconPackagePlus, IconBag, IconTruck, IconBox, IconAlert, IconPlane } from '@/shared/ui'
import type { Action } from '@/shared/ui'

interface Stats { pending_receive: number; in_warehouse: number; pending_orders: number }

export default function WarehouseUzDashboard() {
  const user = useAuthStore((s) => s.user)

  const { data: stats } = useQuery({
    queryKey: ['warehouse-uz-stats'],
    queryFn: () => client.get<Stats>('/warehouse-uz/stats').then((r) => r.data),
  })

  const actions: Action[] = [
    { label: 'Yuk qabul qilish', desc: 'Xitoydan kelgan yuk', path: '/warehouse-uz/receive', icon: <IconPackagePlus size={24} />, gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
    { label: 'Yo\'lovchilar buyurtmalari', desc: 'Tortish va tasdiqlash', path: '/warehouse-uz/orders', icon: <IconBag size={24} />, gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', badge: stats?.pending_orders },
    { label: 'Kuryerga topshirish', desc: 'Toshkent kuryeriga', path: '/warehouse-uz/handover-courier', icon: <IconTruck size={24} />, gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' },
    { label: 'Ombordagi mahsulotlar', desc: 'Hozirgi qoldiq', path: '/warehouse-uz/products', icon: <IconBox size={24} />, gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
    { label: 'Yo\'lovchilar', desc: 'Yo\'lovchilar va yuk holati', path: '/warehouse-uz/carriers', icon: <IconPlane size={24} />, gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)' },
    { label: 'Barcha yuklar', desc: 'Yuk harakatini kuzatish', path: '/warehouse-uz/all-products', icon: <IconBox size={24} />, gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' },
    { label: 'Nizolar', desc: 'Shikast holatlari', path: '/warehouse-uz/disputes', icon: <IconAlert size={24} />, gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' },
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
            <p className="text-xs text-slate-400 mt-0.5">Omborda</p>
          </div>
        </div>
      </div>

      <ActionGrid actions={actions} />
    </div>
  )
}
