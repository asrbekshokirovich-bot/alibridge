import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import type { WarehouseOrder, OrderItemDetail, ProductType } from '@/shared/types'
import { isPiece, unitWord } from '@/shared/lib/product'
import {
  Header, ListSkeleton, EmptyState, StatusBadge, Sheet, Input, Button, ScanInput,
  IconBag, IconCheck, IconBox, IconChevronRight, IconTruck,
} from '@/shared/ui'

type SheetState = { orderId: number; item: OrderItemDetail }

interface Courier { id: number; first_name: string; last_name: string; phone: string }

export default function Orders() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { notify, haptic } = useTelegram()
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [kg, setKg] = useState('')
  const [qty, setQty] = useState('')
  const [error, setError] = useState('')
  // Skan majburiy: yuk barkodi to'g'ri skanlanmaguncha Tasdiqlash bosilmaydi
  const [scanVal, setScanVal] = useState('')
  const [scanned, setScanned] = useState(false)
  // Qaysi buyurtma uchun kuryer tanlanmoqda
  const [handoverFor, setHandoverFor] = useState<WarehouseOrder | null>(null)

  const { data: orders, isLoading } = useQuery({
    queryKey: ['warehouse-uz-orders'],
    queryFn: () => client.get<WarehouseOrder[]>('/warehouse-uz/orders').then((r) => r.data),
  })

  const confirm = useMutation({
    mutationFn: (vars: { orderId: number; itemId: number; type: ProductType; actual_kg?: number; actual_quantity: number }) =>
      client.post(`/warehouse-uz/orders/${vars.orderId}/items/${vars.itemId}/confirm`, {
        actual_quantity: vars.actual_quantity,
        ...(!isPiece(vars.type) ? { actual_kg: vars.actual_kg } : {}),
      }),
    onSuccess: () => {
      notify('success')
      qc.invalidateQueries({ queryKey: ['warehouse-uz-orders'] })
      qc.invalidateQueries({ queryKey: ['warehouse-uz-stats'] })
      setSheet(null); setKg(''); setQty(''); setScanVal(''); setScanned(false)
    },
    onError: (err) => { setError(extractErrorMessage(err)); notify('error') },
  })

  // Tanlangan kuryerga buyurtmani topshirish
  const handover = useMutation({
    mutationFn: (vars: { orderId: number; courierId: number }) =>
      client.post(`/warehouse-uz/orders/${vars.orderId}/handover`, { courier_id: vars.courierId }),
    onSuccess: () => {
      notify('success')
      qc.invalidateQueries({ queryKey: ['warehouse-uz-orders'] })
      qc.invalidateQueries({ queryKey: ['courier-uz-my-products'] })
      setHandoverFor(null)
    },
    onError: (err) => { setError(extractErrorMessage(err)); notify('error') },
  })

  const openSheet = (orderId: number, item: OrderItemDetail) => {
    haptic('light')
    setError('')
    setKg('')
    setScanVal('')
    setScanned(false)
    // Donali uchun so'ralgan sonni default qo'yamiz
    setQty(isPiece(item.type) ? String(Math.round(item.requested_amount)) : '')
    setSheet({ orderId, item })
  }

  // Yuk barkodini skanlash — faqat shu yukniki bo'lsa qabul qilinadi
  const onScanItem = (raw: string) => {
    if (!sheet) return
    const bc = raw.trim()
    setScanVal('')
    if (!bc) return
    if (bc === sheet.item.barcode) {
      setScanned(true)
      setError('')
      notify('success')
    } else {
      setScanned(false)
      notify('error')
      setError(t('Boshqa yuk skanlandi — bu yukning barkodini skanlang'))
    }
  }

  const submit = () => {
    if (!sheet || !scanned) return
    const byWeight = !isPiece(sheet.item.type)
    const q = parseInt(qty, 10)
    const k = parseFloat(kg)
    if (!q || q <= 0) return
    if (byWeight && (!k || k <= 0)) return
    setError('')
    confirm.mutate({
      orderId: sheet.orderId,
      itemId: sheet.item.item_id,
      type: sheet.item.type,
      actual_quantity: q,
      actual_kg: byWeight ? k : undefined,
    })
  }

  const orderBadge = (o: WarehouseOrder) => {
    const done = o.items.filter((i) => i.confirmed).length
    if (o.handed_over) return { tone: 'green' as const, text: t('Topshirildi') }
    if (o.all_confirmed || done === o.items.length) return { tone: 'green' as const, text: t('Tasdiqlandi') }
    if (done > 0) return { tone: 'yellow' as const, text: t('Jarayonda') }
    return { tone: 'gray' as const, text: t('Yangi') }
  }

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title={t("Yo'lovchilar buyurtmalari")} subtitle={t('Tortish va tasdiqlash')} showBack />

      {isLoading ? (
        <ListSkeleton />
      ) : !orders?.length ? (
        <EmptyState icon={<IconBag size={30} />} title={t("Buyurtma yo'q")} description={t('Hozircha tasdiqlash kerak emas')} />
      ) : (
        <div className="px-4 pt-4 space-y-3 web-grid">
          {orders.map((o) => {
            const badge = orderBadge(o)
            const done = o.items.filter((i) => i.confirmed).length
            const allDone = o.all_confirmed || done === o.items.length
            return (
              <div key={o.order_id} className="rounded-2xl border overflow-hidden" style={allDone ? { background: 'rgba(52,211,153,0.10)', borderColor: 'rgba(52,211,153,0.30)', boxShadow: 'var(--shadow-md)' } : { background: 'var(--card-gradient)', borderColor: 'var(--line2)', boxShadow: 'var(--shadow-md)' }}>
                {/* Header */}
                <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--line)' }}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[14.5px] font-bold" style={{ color: 'var(--ink)' }}>{t('Buyurtma #{{id}}', { id: o.order_id })}</span>
                    <StatusBadge tone={badge.tone} dot>{badge.text}</StatusBadge>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    {t('Yo\'lovchi')} {o.carrier_number ? `#${o.carrier_number} — ` : ''}{o.carrier_name}
                  </p>
                </div>

                {/* Mahsulotlar */}
                <div className="divide-y divide-[var(--line)]">
                  {o.items.map((it) => (
                    <button
                      key={it.item_id}
                      onClick={() => !it.confirmed && openSheet(o.order_id, it)}
                      disabled={it.confirmed}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left disabled:cursor-default"
                    >
                      {it.confirmed ? (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(52,211,153,0.14)', color: 'var(--green)' }}>
                          <IconCheck size={18} />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(106,163,255,0.14)', color: '#6aa3ff' }}>
                          <IconBox size={18} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[14.5px] font-bold truncate" style={{ color: 'var(--ink)' }}>
                          {it.product_name}{it.size_label ? ` · ${it.size_label}` : ''}
                        </p>
                        {it.confirmed ? (
                          <p className="text-xs font-semibold" style={{ color: 'var(--green)' }}>
                            {!isPiece(it.type)
                              ? t('{{kg}} kg · {{qty}} dona', { kg: it.actual_kg, qty: it.actual_quantity })
                              : t('{{qty}} dona', { qty: it.actual_quantity })}
                          </p>
                        ) : (
                          <p className="text-xs" style={{ color: 'var(--muted)' }}>
                            {t("So'ralgan:")} {it.requested_amount} {unitWord(it.type)}
                          </p>
                        )}
                      </div>
                      {!it.confirmed && (
                        <span className="shrink-0" style={{ color: 'var(--muted3)' }}><IconChevronRight size={16} /></span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Footer: progress / Topshirish / Topshirildi */}
                {o.handed_over ? (
                  <div className="px-4 py-2.5 text-xs font-semibold flex items-center gap-1.5" style={{ background: 'rgba(52,211,153,0.12)', color: 'var(--green)' }}>
                    <IconTruck size={14} /> {t('Kuryerga topshirildi')}
                  </div>
                ) : allDone ? (
                  <div className="px-4 py-3">
                    <button
                      onClick={() => { haptic('medium'); setError(''); setHandoverFor(o) }}
                      className="press w-full py-3 rounded-xl text-sm font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', boxShadow: '0 8px 24px rgba(34,197,94,0.30)' }}
                    >
                      {t('Topshirish')}
                    </button>
                  </div>
                ) : (
                  <div className="px-4 py-2.5 text-xs font-semibold flex items-center gap-1.5" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>
                    {t('{{done}}/{{total}} tasdiqlandi', { done, total: o.items.length })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Tasdiqlash Sheet — skan majburiy */}
      <Sheet open={!!sheet} onClose={() => setSheet(null)}>
        {sheet && (
          <div className="px-5 pt-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(106,163,255,0.14)', color: '#6aa3ff' }}>
                <IconBox size={22} />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold truncate" style={{ color: 'var(--ink)' }}>
                  {sheet.item.product_name}{sheet.item.size_label ? ` · ${sheet.item.size_label}` : ''}
                </h3>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {t("So'ralgan:")} {sheet.item.requested_amount} {unitWord(sheet.item.type)}
                </p>
              </div>
            </div>

            {/* 1-qadam: barkodni skanlash */}
            {scanned ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-2xl" style={{ background: 'rgba(52,211,153,0.12)', color: 'var(--green)' }}>
                <IconCheck size={18} />
                <span className="text-sm font-semibold">{t('Barkod tasdiqlandi')} · {sheet.item.barcode}</span>
              </div>
            ) : (
              <div className="rounded-2xl border" style={{ borderColor: 'var(--line2)' }}>
                <ScanInput value={scanVal} onChange={setScanVal} onScan={onScanItem} placeholder={t('Yuk barkodini skanlang')} />
              </div>
            )}

            {/* 2-qadam: miqdor — faqat skandan keyin */}
            {scanned && (
              <>
                {!isPiece(sheet.item.type) && (
                  <Input type="number" label={t('Necha kg chiqdi?')} placeholder={t('Tarozida tortilgan kg')}
                    value={kg} onChange={(e) => setKg(e.target.value)} autoFocus />
                )}
                <Input type="number" label={t('Necha dona?')} placeholder={t('Mahsulot soni')}
                  value={qty} onChange={(e) => setQty(e.target.value)} autoFocus={isPiece(sheet.item.type)} />
              </>
            )}

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <Button variant="success" fullWidth disabled={!scanned} loading={confirm.isPending} onClick={submit}>
              {scanned ? t('Tasdiqlash') : t('Avval skanlang')}
            </Button>
          </div>
        )}
      </Sheet>

      {/* Kuryer tanlash Sheet — buyurtmani topshirish */}
      <Sheet open={!!handoverFor} onClose={() => setHandoverFor(null)}>
        {handoverFor && (
          <CourierPicker
            busy={handover.isPending}
            onPick={(courierId) => handover.mutate({ orderId: handoverFor.order_id, courierId })}
          />
        )}
      </Sheet>
    </div>
  )
}

// Sistemadagi kuryerlar ro'yxati — bittasini tanlab buyurtma topshiriladi
function CourierPicker({ busy, onPick }: { busy: boolean; onPick: (courierId: number) => void }) {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ['warehouse-uz-couriers'],
    queryFn: () => client.get<Courier[]>('/warehouse-uz/couriers').then((r) => r.data),
  })

  return (
    <div className="px-5 pt-2 pb-2">
      <h3 className="font-bold mb-1" style={{ color: 'var(--ink)' }}>{t('Qaysi kuryerga?')}</h3>
      <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>{t('Kuryerni tanlang — yuk uning ro\'yxatiga o\'tadi')}</p>
      {isLoading ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState icon={<IconTruck size={30} />} title={t("Kuryer yo'q")} description={t('Faol Toshkent kuryeri topilmadi')} />
      ) : (
        <div className="space-y-2">
          {data.map((c) => (
            <button key={c.id} onClick={() => onPick(c.id)} disabled={busy}
              className="press w-full text-left rounded-2xl p-4 border flex items-center gap-3 disabled:opacity-50"
              style={{ background: 'var(--card-gradient)', borderColor: 'var(--line2)' }}>
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
