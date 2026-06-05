import { Outlet } from 'react-router-dom'
import { BottomNav, IconBox, IconBag, IconHandshake, IconUser } from '@/shared/ui'
import type { NavItem } from '@/shared/ui'

const navItems: NavItem[] = [
  { label: 'Mahsulot', path: '/carrier/products', icon: <IconBox size={22} /> },
  { label: 'Yuklarim', path: '/carrier/my-orders', icon: <IconBag size={22} /> },
  { label: 'Qabul', path: '/carrier/auto-receive', icon: <IconHandshake size={22} /> },
  { label: 'Profil', path: '/carrier/profile', icon: <IconUser size={22} /> },
]

export default function CarrierLayout() {
  return (
    <>
      <Outlet />
      <BottomNav items={navItems} />
    </>
  )
}
