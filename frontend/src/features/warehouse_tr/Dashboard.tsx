import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/shared/store/auth'
import { DashboardHeader, ActionGrid, IconPackagePlus, IconTruck, IconUser, IconBox, IconList, IconPlane } from '@/shared/ui'
import type { Action } from '@/shared/ui'

export default function WarehouseTrDashboard() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const actions: Action[] = [
    { label: t('Jarayondagi yuklar'), desc: t('Yo\'lda — hali yetmagan'), path: '/warehouse-tr/incoming', icon: <IconPlane size={24} />, gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)' },
    { label: t('Yo\'lovchidan qabul'), desc: t('Kelgan yuklarni olish'), path: '/warehouse-tr/receive-carrier', icon: <IconPackagePlus size={24} />, gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' },
    { label: t('Kuryerdan qabul'), desc: t('Kuryer qaytargan yuklar'), path: '/warehouse-tr/receive-courier', icon: <IconTruck size={24} />, gradient: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)' },
    { label: t('Skladdagi yuklar'), desc: t('Hozir omborda turgan'), path: '/warehouse-tr/held', icon: <IconBox size={24} />, gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
    { label: t('Kuryerga topshirish'), desc: t('Yetkazish uchun berish'), path: '/warehouse-tr/handover-courier', icon: <IconTruck size={24} />, gradient: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' },
    { label: t('Telegramsiz mijozlar'), desc: t('Qo\'lda ro\'yxat'), path: '/warehouse-tr/walk-in', icon: <IconUser size={24} />, gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
    { label: t('Toshkent mahsulotlari'), desc: t('Holatni kuzatish'), path: '/warehouse-tr/uz-products', icon: <IconBox size={24} />, gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' },
    { label: t('Kunlik hisobot'), desc: t('Omborga kelgan yuklar'), path: '/warehouse-tr/daily-report', icon: <IconList size={24} />, gradient: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)' },
  ]
  return (
    <div className="min-h-screen animate-fade-in">
      <DashboardHeader role={t('Turkiya ombori')} name={user?.first_name} />
      <ActionGrid actions={actions} />
    </div>
  )
}
