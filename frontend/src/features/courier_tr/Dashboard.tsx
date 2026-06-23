import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/shared/store/auth'
import { DashboardHeader, ActionGrid, IconBox, IconHandshake, IconBag, IconAlert } from '@/shared/ui'
import type { Action } from '@/shared/ui'

export default function CourierTrDashboard() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)

  const actions: Action[] = [
    { label: t('Yo\'lovchidan yuk qabul qilish'), desc: t('Barkodni skanlab qabul qilish'), path: '/courier-tr/receive-from-uz', icon: <IconBox size={24} />, gradient: 'linear-gradient(135deg, #1A3A6C 0%, #132A4D 100%)' },
    { label: t('Mendagi yuklar'), desc: t('Hozir sizda turgan yuklar'), path: '/courier-tr/my-products', icon: <IconBag size={24} />, gradient: 'linear-gradient(135deg, #2f5694 0%, #1A3A6C 100%)' },
    { label: t('Yukni omborga topshirish'), desc: t('Turkiya omboriga topshirish'), path: '/courier-tr/handover-warehouse', icon: <IconHandshake size={24} />, gradient: 'linear-gradient(135deg, #16325c 0%, #0F213D 100%)' },
    { label: t('Zarar yetgan yuklar'), desc: t('Shikast holatlari'), path: '/courier-tr/disputes', icon: <IconAlert size={24} />, gradient: 'linear-gradient(135deg, #132A4D 0%, #0F213D 100%)' },
  ]

  return (
    <div className="min-h-screen animate-fade-in">
      <DashboardHeader role={t('Turkiya kuryeri')} name={user?.first_name} />
      <ActionGrid actions={actions} />
    </div>
  )
}
