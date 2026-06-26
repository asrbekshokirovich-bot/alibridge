import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import client from '@/shared/api/client'
import { useAuthStore } from '@/shared/store/auth'
import { DashboardHeader, ActionSections, IconPlane, IconBox, IconHandshake } from '@/shared/ui'
import type { ActionSection } from '@/shared/ui'

interface MyProduct { carrier_number: number | null; quantity: number }

export default function CourierUzDashboard() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)

  // Hozir kuryerda turgan (yetkazib berilmagan) yuklar — topshirish bo'limida belgi
  const { data: mine } = useQuery({
    queryKey: ['courier-uz-my-products'],
    queryFn: () => client.get<MyProduct[]>('/courier-uz/my-products').then((r) => r.data),
  })
  const items = mine ?? []
  // Buyurtmali (yo'lovchiga topshiriladigan) va jami yetkazilmagan miqdor
  const toCarrier = items.filter((p) => p.carrier_number != null).reduce((s, p) => s + p.quantity, 0)
  const totalPending = items.reduce((s, p) => s + p.quantity, 0)

  // Yuk omborda kuryerga biriktiriladi (warehouse_uz topshiradi) — kuryer o'zi
  // olmaydi. Shuning uchun "Olish" bo'limi yo'q; kuryer faqat o'ziga biriktirilgan
  // yuklarni "Mening yuklarim"da ko'radi va yetkazadi.
  const sections: ActionSection[] = [
    { title: t('Yetkazish'), actions: [
      { label: t('Yo\'lovchiga topshirish'), desc: t('Buyurtma yukini egasiga berish'), path: '/courier-uz/carrier-handover', icon: <IconHandshake size={24} />, gradient: 'linear-gradient(135deg, #2f5694 0%, #1A3A6C 100%)', badge: toCarrier || undefined },
      { label: t('Aeroportda topshirish'), desc: t('Buyurtmasiz yukni berish'), path: '/courier-uz/airport-handover', icon: <IconPlane size={24} />, gradient: 'linear-gradient(135deg, #1A3A6C 0%, #16325c 100%)' },
    ] },
    { title: t('Mening yuklarim'), actions: [
      { label: t('Mening yuklarim'), desc: t('Hozir sizda turgan yuklar'), path: '/courier-uz/my-products', icon: <IconBox size={24} />, gradient: 'linear-gradient(135deg, #132A4D 0%, #0F213D 100%)', badge: totalPending || undefined },
    ] },
  ]
  return (
    <div className="min-h-screen animate-fade-in">
      <DashboardHeader role={t('Toshkent kuryeri')} name={user?.first_name} />
      <ActionSections sections={sections} />
    </div>
  )
}
