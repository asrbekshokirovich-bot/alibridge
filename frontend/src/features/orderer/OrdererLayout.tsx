import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BottomNav, IconHome, IconUser } from '@/shared/ui'
import type { NavItem } from '@/shared/ui'

export default function OrdererLayout() {
  const { t } = useTranslation()
  const navItems: NavItem[] = [
    { label: t('Bosh sahifa'), path: '/orderer', icon: <IconHome size={22} /> },
    { label: t('Profil'), path: '/orderer/profile', icon: <IconUser size={22} /> },
  ]
  return (
    <>
      <Outlet />
      <BottomNav items={navItems} />
    </>
  )
}
