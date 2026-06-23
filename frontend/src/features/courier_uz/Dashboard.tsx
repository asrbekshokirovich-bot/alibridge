import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/shared/store/auth'
import { DashboardHeader, ActionSections, IconList, IconScan, IconPlane, IconBox, IconHandshake } from '@/shared/ui'
import type { ActionSection } from '@/shared/ui'

export default function CourierUzDashboard() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  // Workflow tartibida bo'limlar: Olish → Yetkazish → Mening yuklarim
  const sections: ActionSection[] = [
    { title: t('Olish'), actions: [
      { label: t('Buyurtmani qabul qilish'), desc: t('Buyurtma bo\'yicha olish'), path: '/courier-uz/queue', icon: <IconList size={24} />, gradient: 'linear-gradient(135deg, #1A3A6C 0%, #132A4D 100%)' },
      { label: t('Buyurtmadan tashqari qabul'), desc: t('Istalgan yukni olish'), path: '/courier-uz/scan-pickup', icon: <IconScan size={24} />, gradient: 'linear-gradient(135deg, #16325c 0%, #0F213D 100%)' },
    ] },
    { title: t('Yetkazish'), actions: [
      { label: t('Yo\'lovchiga topshirish'), desc: t('Buyurtma yukini egasiga berish'), path: '/courier-uz/carrier-handover', icon: <IconHandshake size={24} />, gradient: 'linear-gradient(135deg, #2f5694 0%, #1A3A6C 100%)' },
      { label: t('Aeroportda topshirish'), desc: t('Buyurtmasiz yukni berish'), path: '/courier-uz/airport-handover', icon: <IconPlane size={24} />, gradient: 'linear-gradient(135deg, #1A3A6C 0%, #16325c 100%)' },
    ] },
    { title: t('Mening yuklarim'), actions: [
      { label: t('Mening yuklarim'), desc: t('Hozir sizda turgan yuklar'), path: '/courier-uz/my-products', icon: <IconBox size={24} />, gradient: 'linear-gradient(135deg, #132A4D 0%, #0F213D 100%)' },
    ] },
  ]
  return (
    <div className="min-h-screen animate-fade-in">
      <DashboardHeader role={t('Toshkent kuryeri')} name={user?.first_name} />
      <ActionSections sections={sections} />
    </div>
  )
}
