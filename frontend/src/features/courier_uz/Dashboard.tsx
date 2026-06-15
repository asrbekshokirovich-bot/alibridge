import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/shared/store/auth'
import { DashboardHeader, ActionGrid, IconList, IconScan, IconPlane, IconBox, IconHandshake } from '@/shared/ui'
import type { Action } from '@/shared/ui'

export default function CourierUzDashboard() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const actions: Action[] = [
    { label: t('Buyurtmani qabul qilish'), desc: t('Buyurtma bo\'yicha olish'), path: '/courier-uz/queue', icon: <IconList size={24} />, gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' },
    { label: t('Yo\'lovchiga topshirish'), desc: t('Buyurtma yukini egasiga berish'), path: '/courier-uz/carrier-handover', icon: <IconHandshake size={24} />, gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
    { label: t('Buyurtmadan tashqari qabul'), desc: t('Istalgan yukni olish'), path: '/courier-uz/scan-pickup', icon: <IconScan size={24} />, gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' },
    { label: t('Aeroportda topshirish'), desc: t('Buyurtmasiz yukni berish'), path: '/courier-uz/airport-handover', icon: <IconPlane size={24} />, gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' },
    { label: t('Mening yuklarim'), desc: t('Hozir sizda turgan yuklar'), path: '/courier-uz/my-products', icon: <IconBox size={24} />, gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
  ]
  return (
    <div className="min-h-screen animate-fade-in">
      <DashboardHeader role={t('Toshkent kuryeri')} name={user?.first_name} />
      <ActionGrid actions={actions} />
    </div>
  )
}
