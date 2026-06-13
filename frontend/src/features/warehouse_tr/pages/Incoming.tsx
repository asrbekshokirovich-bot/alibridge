import { useQuery } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import type { ProductType } from '@/shared/types'
import { typeEmoji } from '@/shared/lib/product'
import { Header, ListSkeleton, EmptyState, IconTruck } from '@/shared/ui'

interface InTransitItem {
  product_id: number
  barcode: string
  product_name: string
  type: ProductType
  size_label: string
  quantity: number
  stage_label: string
}

interface StageGroup {
  stage: string
  items: InTransitItem[]
  total: number
}

// Bosqich (yo'lovchida / kuryerda) bo'yicha guruhlash
function groupByStage(items: InTransitItem[]): StageGroup[] {
  const map = new Map<string, StageGroup>()
  for (const it of items) {
    const g = map.get(it.stage_label)
    if (g) {
      g.items.push(it)
      g.total += it.quantity
    } else {
      map.set(it.stage_label, { stage: it.stage_label, items: [it], total: it.quantity })
    }
  }
  return [...map.values()]
}

export default function Incoming() {
  const { data: items, isLoading, isError, error } = useQuery({
    queryKey: ['warehouse-tr-incoming'],
    queryFn: () => client.get<InTransitItem[]>('/warehouse-tr/incoming').then((r) => r.data),
    refetchInterval: 30000,
  })

  const groups = groupByStage(items ?? [])
  const total = (items ?? []).reduce((s, p) => s + p.quantity, 0)

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title="Jarayondagi yuklar" subtitle="Yo'lda — hali omborga yetmagan" showBack />

      {isLoading ? (
        <ListSkeleton />
      ) : isError ? (
        <div className="px-4 pt-4">
          <p className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl">{extractErrorMessage(error)}</p>
        </div>
      ) : !items?.length ? (
        <EmptyState icon={<IconTruck size={30} />} title="Yo'lda yuk yo'q"
          description="Hozir yo'lovchida yoki kuryerda turgan yuk yo'q" />
      ) : (
        <>
          <div className="px-4 pt-4 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">Jami</span>
            <span className="text-sm font-bold px-2.5 py-0.5 rounded-full text-white" style={{ background: 'var(--brand-gradient)' }}>
              {total} ta
            </span>
          </div>

          {groups.map((g) => (
            <div key={g.stage} className="px-4 pt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-900">{g.stage}</h3>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{g.total} ta</span>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50 web-grid">
                {g.items.map((p) => (
                  <div key={`${p.product_id}:${p.size_label}`} className="flex items-center gap-3 p-3.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-lg shrink-0">
                      {typeEmoji(p.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-slate-900 truncate">
                        {p.product_name}{p.size_label ? ` · ${p.size_label}` : ''}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400">{p.barcode}</p>
                    </div>
                    <span className="text-sm font-bold text-white px-2 py-0.5 rounded-lg shrink-0" style={{ background: 'var(--brand)' }}>
                      {p.quantity} ta
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
