import { useAuthStore } from '@/shared/store/auth'
import { DashboardHeader, ActionGrid, IconList, IconScan, IconPlane } from '@/shared/ui'
import type { Action } from '@/shared/ui'

const actions: Action[] = [
  { label: 'Yetkazish navbati', desc: 'Yo\'lovchilardan olish', path: '/courier-uz/queue', icon: <IconList size={24} />, gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' },
  { label: 'Ombordan olish', desc: 'Mustaqil mahsulot olish', path: '/courier-uz/scan-pickup', icon: <IconScan size={24} />, gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' },
  { label: 'Aeroportda topshirish', desc: 'Yo\'lovchiga berish', path: '/courier-uz/airport-handover', icon: <IconPlane size={24} />, gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' },
]

export default function CourierUzDashboard() {
  const user = useAuthStore((s) => s.user)
  return (
    <div className="min-h-screen animate-fade-in">
      <DashboardHeader role="Toshkent kuryeri" name={user?.first_name} />
      <ActionGrid actions={actions} />
    </div>
  )
}
