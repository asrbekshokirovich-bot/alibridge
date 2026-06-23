import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import { Header, ListSkeleton, EmptyState, IconBox } from '@/shared/ui'

interface DailyOutItem {
  barcode: string
  product_name: string
  size_label: string
  quantity: number
  from_label: string
  to_label: string
  by_name: string
  time: string
}

interface DailyOutReport {
  date: string
  total: number
  items: DailyOutItem[]
}

interface Props {
  apiUrl: string         // '/warehouse-uz/daily-out' yoki '/warehouse-tr/daily-in'
  queryKey: string       // keshlash uchun noyob kalit
  subtitle: string       // 'Toshkent ombori' / 'Barcha omborlar'
  metricLabel?: string   // 'Chiqdi' (default) / 'Keldi'
  emptyTitle?: string    // 'Chiqim yo'q' (default)
  emptyDesc?: string     // 'Bu kuni ombordan yuk chiqmagan' (default)
}

// Bugungi sana — YYYY-MM-DD (mahalliy)
function todayStr(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function DailyReport({
  apiUrl, queryKey, subtitle,
  metricLabel,
  emptyTitle,
  emptyDesc,
}: Props) {
  const { t } = useTranslation()
  const [date, setDate] = useState(todayStr())

  const metricLabelText = metricLabel ?? t('Chiqdi')
  const emptyTitleText = emptyTitle ?? t('Chiqim yo\'q')
  const emptyDescText = emptyDesc ?? t('Bu kuni ombordan yuk chiqmagan')

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [queryKey, date],
    queryFn: () => client.get<DailyOutReport>(`${apiUrl}?date_str=${date}`).then((r) => r.data),
  })

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title={t('Kunlik hisobot')} subtitle={subtitle} showBack />

      {/* Sana tanlash + jami */}
      <div className="px-4 pt-4">
        <div
          className="rounded-2xl border p-4 flex items-center justify-between gap-3"
          style={{ background: 'var(--surface)', borderColor: 'var(--line)', boxShadow: 'var(--shadow-md)' }}
        >
          <div className="flex-1">
            <label className="text-xs block mb-1" style={{ color: 'var(--muted2)' }}>{t('Sana')}</label>
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm font-semibold"
              style={{ background: 'var(--surface2)', border: '1px solid var(--line2)', color: 'var(--ink)' }}
            />
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.05em]" style={{ color: 'var(--muted2)' }}>{metricLabelText}</p>
            <p className="text-[26px] font-extrabold tabular-nums leading-none mt-1" style={{ color: 'var(--royal)' }}>
              {data?.total ?? 0}
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--muted3)' }}>{t('ta')}</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : isError ? (
        <div className="px-4 pt-4">
          <p className="text-sm px-4 py-3 rounded-2xl" style={{ background: 'rgba(239,68,68,0.10)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.25)' }}>{extractErrorMessage(error)}</p>
        </div>
      ) : !data?.items.length ? (
        <EmptyState icon={<IconBox size={30} />} title={emptyTitleText} description={emptyDescText} />
      ) : (
        <div className="px-4 pt-4 space-y-2 web-grid">
          {data.items.map((it, i) => (
            <div
              key={i}
              className="rounded-2xl p-3.5 border flex items-center gap-3"
              style={{ background: 'var(--surface)', borderColor: 'var(--line)', boxShadow: 'var(--shadow-md)' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: '#EBF1FA', color: 'var(--royal)' }}
              >
                <IconBox size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: 'var(--ink)' }}>
                  {it.product_name}{it.size_label ? ` · ${it.size_label}` : ''}
                </p>
                <p className="text-[11px] font-mono" style={{ color: 'var(--muted2)' }}>{it.barcode}</p>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] flex-wrap" style={{ color: 'var(--muted)' }}>
                  <span className="px-1.5 py-0.5 rounded" style={{ background: 'var(--surface2)' }}>{it.from_label}</span>
                  <span style={{ color: 'var(--muted3)' }}>→</span>
                  <span className="px-1.5 py-0.5 rounded" style={{ background: 'var(--surface2)' }}>{it.to_label}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span
                  className="text-base font-extrabold tabular-nums text-white px-2.5 py-1 rounded-lg"
                  style={{ background: 'var(--royal)' }}
                >
                  {t('{{n}} ta', { n: it.quantity })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
