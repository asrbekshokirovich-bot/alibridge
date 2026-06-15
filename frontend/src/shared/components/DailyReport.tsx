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
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between gap-3">
          <div className="flex-1">
            <label className="text-xs text-slate-400 block mb-1">{t('Sana')}</label>
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900"
            />
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-slate-400">{metricLabelText}</p>
            <p className="text-2xl font-extrabold" style={{ color: 'var(--brand)' }}>
              {data?.total ?? 0}
            </p>
            <p className="text-[11px] text-slate-400">{t('ta')}</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : isError ? (
        <div className="px-4 pt-4">
          <p className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl">{extractErrorMessage(error)}</p>
        </div>
      ) : !data?.items.length ? (
        <EmptyState icon={<IconBox size={30} />} title={emptyTitleText} description={emptyDescText} />
      ) : (
        <div className="px-4 pt-4 space-y-2 web-grid">
          {data.items.map((it, i) => (
            <div key={i} className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-lg shrink-0">📦</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-slate-900 truncate">
                  {it.product_name}{it.size_label ? ` · ${it.size_label}` : ''}
                </p>
                <p className="text-[11px] font-mono text-slate-400">{it.barcode}</p>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 flex-wrap">
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded">{it.from_label}</span>
                  <span>→</span>
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded">{it.to_label}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-base font-extrabold text-white px-2.5 py-1 rounded-lg" style={{ background: 'var(--brand)' }}>
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
