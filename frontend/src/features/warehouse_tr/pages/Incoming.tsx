import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import client, { extractErrorMessage } from '@/shared/api/client'
import type { ProductType } from '@/shared/types'
import { typeEmoji } from '@/shared/lib/product'
import { Header, ListSkeleton, EmptyState, IconTruck, IconUser, IconChevronDown } from '@/shared/ui'

interface InTransitItem {
  product_id: number
  barcode: string
  product_name: string
  type: ProductType
  size_label: string
  quantity: number
  stage_label: string
  holder_id: number
  holder_name: string
  holder_number: number | null
}

interface HolderGroup {
  holder_id: number
  holder_name: string
  holder_number: number | null
  items: InTransitItem[]
  total: number
}

interface StageGroup {
  stage: string
  holders: HolderGroup[]
  total: number
}

// Bosqich (yo'lovchida / kuryerda) → ega (yo'lovchi/kuryer) bo'yicha guruhlash
function groupByStageAndHolder(items: InTransitItem[]): StageGroup[] {
  const stages = new Map<string, Map<number, HolderGroup>>()
  for (const it of items) {
    let holders = stages.get(it.stage_label)
    if (!holders) {
      holders = new Map<number, HolderGroup>()
      stages.set(it.stage_label, holders)
    }
    const h = holders.get(it.holder_id)
    if (h) {
      h.items.push(it)
      h.total += it.quantity
    } else {
      holders.set(it.holder_id, {
        holder_id: it.holder_id,
        holder_name: it.holder_name,
        holder_number: it.holder_number,
        items: [it],
        total: it.quantity,
      })
    }
  }
  return [...stages.entries()].map(([stage, holders]) => {
    const list = [...holders.values()]
    return { stage, holders: list, total: list.reduce((s, g) => s + g.total, 0) }
  })
}

export default function Incoming() {
  const { t } = useTranslation()
  const [open, setOpen] = useState<Record<number, boolean>>({})
  const { data: items, isLoading, isError, error } = useQuery({
    queryKey: ['warehouse-tr-incoming'],
    queryFn: () => client.get<InTransitItem[]>('/warehouse-tr/incoming').then((r) => r.data),
    refetchInterval: 30000,
  })

  const groups = groupByStageAndHolder(items ?? [])
  const total = (items ?? []).reduce((s, p) => s + p.quantity, 0)

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title={t('Jarayondagi yuklar')} subtitle={t("Yo'lda — hali omborga yetmagan")} showBack />

      {isLoading ? (
        <ListSkeleton />
      ) : isError ? (
        <div className="px-4 pt-4">
          <p className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl">{extractErrorMessage(error)}</p>
        </div>
      ) : !items?.length ? (
        <EmptyState icon={<IconTruck size={30} />} title={t("Yo'lda yuk yo'q")}
          description={t("Hozir yo'lovchida yoki kuryerda turgan yuk yo'q")} />
      ) : (
        <>
          <div className="px-4 pt-4 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">{t('Jami')}</span>
            <span className="text-sm font-bold px-2.5 py-0.5 rounded-full text-white" style={{ background: 'var(--brand-gradient)' }}>
              {t('{{n}} ta', { n: total })}
            </span>
          </div>

          {groups.map((g) => (
            <div key={g.stage} className="px-4 pt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-900">{g.stage}</h3>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{t('{{n}} ta', { n: g.total })}</span>
              </div>

              <div className="space-y-2">
                {g.holders.map((h) => {
                  const isOpen = open[h.holder_id] ?? false
                  return (
                    <div key={h.holder_id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden web-grid">
                      <button
                        type="button"
                        onClick={() => setOpen((s) => ({ ...s, [h.holder_id]: !isOpen }))}
                        className="w-full flex items-center gap-3 p-3.5 text-left active:bg-slate-50 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                          <IconUser size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-900 truncate">
                            {h.holder_name || t('Nomalum')}
                          </p>
                          {h.holder_number != null && (
                            <p className="text-[11px] font-mono text-slate-400">ALB-{h.holder_number}</p>
                          )}
                        </div>
                        <span className="text-sm font-bold text-white px-2 py-0.5 rounded-lg shrink-0" style={{ background: 'var(--brand)' }}>
                          {t('{{n}} ta', { n: h.total })}
                        </span>
                        <IconChevronDown
                          size={18}
                          className={`text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {isOpen && (
                        <div className="divide-y divide-slate-50 border-t border-slate-100">
                          {h.items.map((p) => (
                            <div key={`${p.product_id}:${p.size_label}`} className="flex items-center gap-3 p-3.5 pl-4">
                              <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-base shrink-0">
                                {typeEmoji(p.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-slate-900 truncate">
                                  {p.product_name}{p.size_label ? ` · ${p.size_label}` : ''}
                                </p>
                                <p className="text-[11px] font-mono text-slate-400">{p.barcode}</p>
                              </div>
                              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg shrink-0">
                                {t('{{n}} ta', { n: p.quantity })}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
