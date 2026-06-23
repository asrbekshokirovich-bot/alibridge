import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/shared/store/auth'
import { DashboardHeader, ActionSections, IconPackagePlus, IconTruck, IconUser, IconBox, IconList, IconPlane, IconAlert } from '@/shared/ui'
import type { ActionSection } from '@/shared/ui'

export default function WarehouseTrDashboard() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  // Workflow tartibida bo'limlar: Qabul → Omborda → Topshirish → Hisobot
  const sections: ActionSection[] = [
    { title: t('Qabul'), actions: [
      { label: t('Jarayondagi yuklar'), desc: t('Yo\'lda — hali yetmagan'), path: '/warehouse-tr/incoming', icon: <IconPlane size={24} />, gradient: 'linear-gradient(135deg, #1A3A6C 0%, #132A4D 100%)' },
      { label: t('Yo\'lovchidan qabul'), desc: t('Kelgan yuklarni olish'), path: '/warehouse-tr/receive-carrier', icon: <IconPackagePlus size={24} />, gradient: 'linear-gradient(135deg, #16325c 0%, #0F213D 100%)' },
      { label: t('Kuryerdan qabul'), desc: t('Kuryer qaytargan yuklar'), path: '/warehouse-tr/receive-courier', icon: <IconTruck size={24} />, gradient: 'linear-gradient(135deg, #1A3A6C 0%, #16325c 100%)' },
    ] },
    { title: t('Omborda'), actions: [
      { label: t('Skladdagi yuklar'), desc: t('Hozir omborda turgan'), path: '/warehouse-tr/held', icon: <IconBox size={24} />, gradient: 'linear-gradient(135deg, #132A4D 0%, #0F213D 100%)' },
      { label: t('Toshkent mahsulotlari'), desc: t('Holatni kuzatish'), path: '/warehouse-tr/uz-products', icon: <IconBox size={24} />, gradient: 'linear-gradient(135deg, #1A3A6C 0%, #0F213D 100%)' },
    ] },
    { title: t('Topshirish'), actions: [
      { label: t('Kuryerga topshirish'), desc: t('Yetkazish uchun berish'), path: '/warehouse-tr/handover-courier', icon: <IconTruck size={24} />, gradient: 'linear-gradient(135deg, #1A3A6C 0%, #132A4D 100%)' },
      { label: t('Telegramsiz mijozlar'), desc: t('Qo\'lda ro\'yxat'), path: '/warehouse-tr/walk-in', icon: <IconUser size={24} />, gradient: 'linear-gradient(135deg, #16325c 0%, #132A4D 100%)' },
    ] },
    { title: t('Hisobot'), actions: [
      { label: t('Kunlik hisobot'), desc: t('Omborga kelgan yuklar'), path: '/warehouse-tr/daily-report', icon: <IconList size={24} />, gradient: 'linear-gradient(135deg, #132A4D 0%, #16325c 100%)' },
      { label: t('Zarar yetgan yuklar'), desc: t('Shikast holatlari'), path: '/warehouse-tr/disputes', icon: <IconAlert size={24} />, gradient: 'linear-gradient(135deg, #16325c 0%, #0F213D 100%)' },
    ] },
  ]
  return (
    <div className="min-h-screen animate-fade-in">
      <DashboardHeader role={t('Turkiya ombori')} name={user?.first_name} />
      <ActionSections sections={sections} />
    </div>
  )
}
