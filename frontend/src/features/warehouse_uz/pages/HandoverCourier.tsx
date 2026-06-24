import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import client from '@/shared/api/client'
import { ScanSession, Header, ListSkeleton, EmptyState, IconTruck, IconChevronRight } from '@/shared/ui'

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
              className="press w-full text-left rounded-2xl p-4 border flex items-center gap-3"
              style={{ background: 'var(--card-gradient)', borderColor: 'var(--line2)', boxShadow: 'var(--shadow-md)' }}
            >
              <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(106,163,255,0.14)', color: '#6aa3ff' }}>
                <IconTruck size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14.5px] font-bold truncate" style={{ color: 'var(--ink)' }}>{`${c.first_name} ${c.last_name}`.trim()}</p>
                {c.phone && <p className="text-xs" style={{ color: 'var(--muted)' }}>{c.phone}</p>}
              </div>
              <span className="shrink-0" style={{ color: 'var(--muted3)' }}><IconChevronRight size={18} /></span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
