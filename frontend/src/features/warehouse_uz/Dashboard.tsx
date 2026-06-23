import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import client from '@/shared/api/client'
import { useAuthStore } from '@/shared/store/auth'
import { DashboardHeader, ActionSections, IconPackagePlus, IconBag, IconTruck, IconBox, IconAlert, IconPlane, IconList } from '@/shared/ui'
import type { ActionSection } from '@/shared/ui'

interface Stats { pending_receive: number; in_warehouse: number; pending_orders: number }

export default function WarehouseUzDashboard() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const { data: stats } = useQuery({
    queryKey: ['warehouse-uz-stats'],
    queryFn: () => client.get<Stats>('/warehouse-uz/stats').then((r) => r.data),
  })

  const royal = 'linear-gradient(135deg, #1A3A6C 0%, #132A4D 100%)'
  const navy = 'linear-gradient(135deg, #16325c 0%, #0F213D 100%)'

  // Workflow tartibida bo'limlar: Qabul → Omborda → Topshirish → Hisobot
  const sections: ActionSection[] = [
    { title: t('Qabul'), actions: [
      { label: t('Yuk qabul qilish'), desc: t('Xitoydan kelgan yuk'), path: '/warehouse-uz/receive', icon: <IconPackagePlus size={24} />, gradient: royal },
    ] },
    { title: t('Omborda'), actions: [
      { label: t('Yo\'lovchilar buyurtmalari'), desc: t('Tortish va tasdiqlash'), path: '/warehouse-uz/orders', icon: <IconBag size={24} />, gradient: navy, badge: stats?.pending_orders },
      { label: t('Ombordagi mahsulotlar'), desc: t('Hozirgi qoldiq'), path: '/warehouse-uz/products', icon: <IconBox size={24} />, gradient: navy },
      { label: t('Barcha yuklar'), desc: t('Yuk harakatini kuzatish'), path: '/warehouse-uz/all-products', icon: <IconBox size={24} />, gradient: navy },
      { label: t('Yo\'lovchilar'), desc: t('Yo\'lovchilar va yuk holati'), path: '/warehouse-uz/carriers', icon: <IconPlane size={24} />, gradient: royal },
    ] },
    { title: t('Topshirish'), actions: [
      { label: t('Kuryerga topshirish'), desc: t('Toshkent kuryeriga'), path: '/warehouse-uz/handover-courier', icon: <IconTruck size={24} />, gradient: royal },
    ] },
    { title: t('Hisobot'), actions: [
      { label: t('Nizolar'), desc: t('Shikast holatlari'), path: '/warehouse-uz/disputes', icon: <IconAlert size={24} />, gradient: royal },
      { label: t('Kunlik hisobot'), desc: t('Ombordan chiqqan yuklar'), path: '/warehouse-uz/daily-report', icon: <IconList size={24} />, gradient: navy },
    ] },
  ]

  return (
    <div className="min-h-screen animate-fade-in" style={{ background: 'var(--bg)' }}>
      <DashboardHeader role={t('Toshkent ombori')} name={user?.first_name} />
      <ActionSections sections={sections} />
    </div>
  )
}
