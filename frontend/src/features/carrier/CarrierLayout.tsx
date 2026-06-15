import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BottomNav, IconBox, IconBag, IconHandshake, IconUser } from '@/shared/ui'
import type { NavItem } from '@/shared/ui'

export default function CarrierLayout() {
  const { t } = useTranslation()
  const navItems: NavItem[] = [
    { label: t('Mahsulot'), path: '/carrier/products', icon: <IconBox size={22} /> },
    { label: t('Yuklarim'), path: '/carrier/my-orders', icon: <IconBag size={22} /> },
    { label: t('Qabul'), path: '/carrier/auto-receive', icon: <IconHandshake size={22} /> },
    { label: t('Profil'), path: '/carrier/profile', icon: <IconUser size={22} /> },
  ]
  return (
    <>
      <Outlet />
      <BottomNav items={navItems} />
    </>
  )
}
