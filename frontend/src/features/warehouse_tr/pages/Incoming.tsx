import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import client, { extractErrorMessage } from '@/shared/api/client'
import type { ProductType } from '@/shared/types'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { Header, ListSkeleton, EmptyState, IconTruck, IconUser, IconChevronDown, IconBox, IconPlane } from '@/shared/ui'

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
  holder_phone: string
  holder_username: string | null
  holder_telegram_id: number | null
  flight_date: string | null
  flight_number: string | null
  delivery_address_tr: string
}

interface HolderGroup {
  holder_id: number
  holder_name: string
  holder_number: number | null
  holder_phone: string
  holder_username: string | null
  holder_telegram_id: number | null
  flight_date: string | null
  flight_number: string | null
  delivery_address_tr: string
  items: InTransitItem[]
  total: number
}

// Telegram profil havolasi (lichkaga o'tish).
// Mini App'da openTelegramLink faqat t.me/... ni qabul qiladi —
// username bo'lmasa profilga o'tib bo'lmaydi (Telegram cheklovi).
function telegramLink(username: string | null): string | null {
  return username ? `https://t.me/${username}` : null
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
        holder_phone: it.holder_phone,
        holder_username: it.holder_username,
        holder_telegram_id: it.holder_telegram_id,
        flight_date: it.flight_date,
        flight_number: it.flight_number,
        delivery_address_tr: it.delivery_address_tr,
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
  const { openTelegramLink, openLink } = useTelegram()
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
          <p className="text-sm px-4 py-3 rounded-2xl" style={{ background: 'rgba(239,68,68,0.10)', color: 'var(--red)' }}>{extractErrorMessage(error)}</p>
        </div>
      ) : !items?.length ? (
        <EmptyState icon={<IconTruck size={30} />} title={t("Yo'lda yuk yo'q")}
          description={t("Hozir yo'lovchida yoki kuryerda turgan yuk yo'q")} />
      ) : (
        <>
          <div className="px-4 pt-4 flex items-center justify-between">
            <span className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{t('Jami')}</span>
            <span className="text-sm font-bold px-2.5 py-0.5 rounded-full text-white tabular-nums" style={{ background: 'var(--royal)' }}>
              {t('{{n}} ta', { n: total })}
            </span>
          </div>

          {groups.map((g) => (
            <div key={g.stage} className="px-4 pt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{g.stage}</h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full tabular-nums" style={{ background: '#F1F4F8', color: 'var(--muted)' }}>{t('{{n}} ta', { n: g.total })}</span>
              </div>

              <div className="space-y-2">
                {g.holders.map((h) => {
                  const isOpen = open[h.holder_id] ?? false
                  const tgLink = telegramLink(h.holder_username)
                  const openProfile = () => { if (tgLink) openTelegramLink(tgLink) }
                  return (
                    <div key={h.holder_id} className="rounded-2xl border overflow-hidden web-grid" style={{ background: 'var(--surface)', borderColor: 'var(--line)', boxShadow: 'var(--shadow-md)' }}>
                      <div className="flex items-center gap-3 p-3.5">
                        {tgLink ? (
                          <button
                            type="button"
                            onClick={openProfile}
                            aria-label={t('Telegram profili')}
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 press"
                            style={{ background: 'var(--royal)' }}
                          >
                            <IconUser size={20} />
                          </button>
                        ) : (
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#EBF1FA', color: 'var(--royal)' }}>
                            <IconUser size={20} />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          {tgLink ? (
                            <button
                              type="button"
                              onClick={openProfile}
                              className="font-bold text-[14.5px] truncate block text-left hover:underline"
                              style={{ color: 'var(--royal)' }}
                            >
                              {h.holder_name || t('Nomalum')}
                            </button>
                          ) : (
                            <p className="font-bold text-[14.5px] truncate" style={{ color: 'var(--ink)' }}>
                              {h.holder_name || t('Nomalum')}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] mt-0.5" style={{ color: 'var(--muted2)' }}>
                            {h.holder_number != null && <span className="font-mono">ALB-{h.holder_number}</span>}
                            {h.holder_phone && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); openLink(`tel:${h.holder_phone}`) }}
                                className="font-mono hover:underline"
                              >
                                {h.holder_phone}
                              </button>
                            )}
                          </div>
                          {(h.flight_number || h.flight_date) && (
                            <p className="text-[11px] mt-1 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                              <IconPlane size={13} /> {[h.flight_number, h.flight_date].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          {h.delivery_address_tr && (
                            <p className="text-[11px] mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                              {h.delivery_address_tr}
                            </p>
                          )}
                        </div>

                        <span className="text-sm font-bold text-white px-2 py-0.5 rounded-lg shrink-0 tabular-nums" style={{ background: 'var(--royal)' }}>
                          {t('{{n}} ta', { n: h.total })}
                        </span>
                        <button
                          type="button"
                          aria-label={t('Yuklarni ochish')}
                          onClick={() => setOpen((s) => ({ ...s, [h.holder_id]: !isOpen }))}
                          className="shrink-0 p-1 -m-1 press"
                          style={{ color: 'var(--muted3)' }}
                        >
                          <IconChevronDown
                            size={18}
                            className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </div>

                      {isOpen && (
                        <div className="border-t" style={{ borderColor: 'var(--line)' }}>
                          {h.items.map((p) => (
                            <div key={`${p.product_id}:${p.size_label}`} className="flex items-center gap-3 p-3.5 pl-4 border-t first:border-t-0" style={{ borderColor: 'var(--line)' }}>
                              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#EBF1FA', color: 'var(--royal)' }}>
                                <IconBox size={18} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate" style={{ color: 'var(--ink)' }}>
                                  {p.product_name}{p.size_label ? ` · ${p.size_label}` : ''}
                                </p>
                                <p className="text-[11px] font-mono" style={{ color: 'var(--muted2)' }}>{p.barcode}</p>
                              </div>
                              <span className="text-xs font-bold px-2 py-0.5 rounded-lg shrink-0 tabular-nums" style={{ background: '#F1F4F8', color: 'var(--muted)' }}>
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
