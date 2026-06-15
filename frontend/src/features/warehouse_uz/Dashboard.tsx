import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import client from '@/shared/api/client'
import { ActionGrid, LangSwitcher, IconPackagePlus, IconBag, IconTruck, IconBox, IconAlert, IconPlane, IconList } from '@/shared/ui'
import type { Action } from '@/shared/ui'

interface Stats { pending_receive: number; in_warehouse: number; pending_orders: number }

export default function WarehouseUzDashboard() {
  const { t } = useTranslation()
  const { data: stats } = useQuery({
    queryKey: ['warehouse-uz-stats'],
    queryFn: () => client.get<Stats>('/warehouse-uz/stats').then((r) => r.data),
  })

  const actions: Action[] = [
    { label: t('Yuk qabul qilish'), desc: t('Xitoydan kelgan yuk'), path: '/warehouse-uz/receive', icon: <IconPackagePlus size={24} />, gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
    { label: t('Yo\'lovchilar buyurtmalari'), desc: t('Tortish va tasdiqlash'), path: '/warehouse-uz/orders', icon: <IconBag size={24} />, gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', badge: stats?.pending_orders },
    { label: t('Kuryerga topshirish'), desc: t('Toshkent kuryeriga'), path: '/warehouse-uz/handover-courier', icon: <IconTruck size={24} />, gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' },
    { label: t('Ombordagi mahsulotlar'), desc: t('Hozirgi qoldiq'), path: '/warehouse-uz/products', icon: <IconBox size={24} />, gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
    { label: t('Yo\'lovchilar'), desc: t('Yo\'lovchilar va yuk holati'), path: '/warehouse-uz/carriers', icon: <IconPlane size={24} />, gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)' },
    { label: t('Barcha yuklar'), desc: t('Yuk harakatini kuzatish'), path: '/warehouse-uz/all-products', icon: <IconBox size={24} />, gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' },
    { label: t('Nizolar'), desc: t('Shikast holatlari'), path: '/warehouse-uz/disputes', icon: <IconAlert size={24} />, gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' },
    { label: t('Kunlik hisobot'), desc: t('Ombordan chiqqan yuklar'), path: '/warehouse-uz/daily-report', icon: <IconList size={24} />, gradient: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)' },
  ]

  return (
    <div className="min-h-screen animate-fade-in pt-4">
      <div className="px-4 flex justify-end">
        <LangSwitcher dark={false} />
      </div>
      <ActionGrid actions={actions} />
    </div>
  )
}
