import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import client from '@/shared/api/client'
import { ScanSession, Header, ListSkeleton, EmptyState, IconTruck } from '@/shared/ui'

interface Courier {
  id: number
  first_name: string
  last_name: string
  phone: string
}

export default function HandoverCourier() {
  const { t } = useTranslation()
  const [courier, setCourier] = useState<Courier | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['warehouse-uz-couriers'],
    queryFn: () => client.get<Courier[]>('/warehouse-uz/couriers').then((r) => r.data),
    enabled: !courier,
  })

  // Kuryer tanlangach — skanlash sessiyasi (courier_id confirmBody orqali ketadi)
  if (courier) {
    return (
      <ScanSession
        title={t('Kuryerga topshirish')}
        subtitle={`${courier.first_name} ${courier.last_name}`.trim()}
        showBack
        onBack={() => setCourier(null)}
        scanUrl="/warehouse-uz/scan-for-courier"
        confirmUrl="/warehouse-uz/confirm-courier-handover"
        confirmBody={{ courier_id: courier.id }}
        successTitle={t('Topshirildi!')}
        successDesc={(n) => t("{{n}} ta mahsulot kuryerga o'tdi.", { n })}
      />
    )
  }

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title={t('Kuryerga topshirish')} subtitle={t('Avval kuryerni tanlang')} showBack />

      {isLoading ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState icon={<IconTruck size={30} />} title={t("Kuryer yo'q")} description={t('Faol Toshkent kuryeri topilmadi')} />
      ) : (
        <div className="px-4 pt-4 space-y-2 web-grid">
          {data.map((c) => (
            <button
              key={c.id}
              onClick={() => setCourier(c)}
              className="press w-full text-left bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3"
            >
              <div className="w-11 h-11 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center shrink-0">
                <IconTruck size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 truncate">{`${c.first_name} ${c.last_name}`.trim()}</p>
                {c.phone && <p className="text-xs text-slate-400">{c.phone}</p>}
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-slate-300 shrink-0">
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
