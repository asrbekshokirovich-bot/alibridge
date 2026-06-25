import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import client from '@/shared/api/client'
import { ScanSession, ListSkeleton, EmptyState, IconTruck, IconChevronRight } from '@/shared/ui'

interface Courier {
  id: number
  first_name: string
  last_name: string
  phone: string
}

// Skandan KEYIN ochiladigan kuryer tanlash oynasi (ScanSession gate ichida).
function CourierPicker({
  totalQty,
  onPick,
  onCancel,
}: {
  totalQty: number
  onPick: (courierId: number) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ['warehouse-uz-couriers'],
    queryFn: () => client.get<Courier[]>('/warehouse-uz/couriers').then((r) => r.data),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-base font-bold" style={{ color: 'var(--ink)' }}>{t('Qaysi kuryerga?')}</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('{{n}} ta yuk topshiriladi', { n: totalQty })}</p>
        </div>
        <button onClick={onCancel} className="press text-sm font-semibold px-3 py-1.5 rounded-xl" style={{ color: 'var(--muted)' }}>
          {t('Bekor')}
        </button>
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState icon={<IconTruck size={30} />} title={t("Kuryer yo'q")} description={t('Faol Toshkent kuryeri topilmadi')} />
      ) : (
        <div className="space-y-2">
          {data.map((c) => (
            <button
              key={c.id}
              onClick={() => onPick(c.id)}
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

export default function HandoverCourier() {
  const { t } = useTranslation()

  // Avval yuklarni skanlaymiz — tasdiqlash bosilganda kuryer tanlash ochiladi.
  return (
    <ScanSession
      title={t('Kuryerga topshirish')}
      subtitle={t('Yuklarni skanlang')}
      showBack
      scanUrl="/warehouse-uz/scan-for-courier"
      confirmUrl="/warehouse-uz/confirm-courier-handover"
      successTitle={t('Topshirildi!')}
      successDesc={(n) => t("{{n}} ta mahsulot kuryerga o'tdi.", { n })}
      renderConfirmGate={({ proceed, cancel, totalQty }) => (
        <CourierPicker
          totalQty={totalQty}
          onCancel={cancel}
          onPick={(courierId) => proceed({ courier_id: courierId })}
        />
      )}
    />
  )
}
