import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import type { WarehouseOrder, OrderItemDetail, ProductType } from '@/shared/types'
import { isPiece, typeEmoji, unitWord } from '@/shared/lib/product'
import { Header, ListSkeleton, EmptyState, StatusBadge, Sheet, Input, Button, IconBag, IconCheck } from '@/shared/ui'

type SheetState = { orderId: number; item: OrderItemDetail }

export default function Orders() {
  const qc = useQueryClient()
  const { notify, haptic } = useTelegram()
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [kg, setKg] = useState('')
  const [qty, setQty] = useState('')
  const [error, setError] = useState('')

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
      setSheet(null); setKg(''); setQty('')
    },
    onError: (err) => { setError(extractErrorMessage(err)); notify('error') },
  })

  const openSheet = (orderId: number, item: OrderItemDetail) => {
    haptic('light')
    setError('')
    setKg('')
    // Donali uchun so'ralgan sonni default qo'yamiz
    setQty(isPiece(item.type) ? String(Math.round(item.requested_amount)) : '')
    setSheet({ orderId, item })
  }

  const submit = () => {
    if (!sheet) return
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
    if (done === o.items.length) return { tone: 'green' as const, text: 'Tayyor' }
    if (done > 0) return { tone: 'yellow' as const, text: 'Jarayonda' }
    return { tone: 'gray' as const, text: 'Yangi' }
  }

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title="Yo'lovchilar buyurtmalari" subtitle="Tortish va tasdiqlash" showBack />

      {isLoading ? (
        <ListSkeleton />
      ) : !orders?.length ? (
        <EmptyState icon={<IconBag size={30} />} title="Buyurtma yo'q" description="Hozircha tasdiqlash kerak emas" />
      ) : (
        <div className="px-4 pt-4 space-y-3">
          {orders.map((o) => {
            const badge = orderBadge(o)
            const done = o.items.filter((i) => i.confirmed).length
            return (
              <div key={o.order_id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-slate-50">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-bold text-slate-900">Buyurtma #{o.order_id}</span>
                    <StatusBadge tone={badge.tone} dot>{badge.text}</StatusBadge>
                  </div>
                  <p className="text-xs text-slate-400">
                    Yo'lovchi {o.carrier_number ? `#${o.carrier_number} — ` : ''}{o.carrier_name}
                  </p>
                </div>

                {/* Mahsulotlar */}
                <div className="divide-y divide-slate-50">
                  {o.items.map((it) => (
                    <button
                      key={it.item_id}
                      onClick={() => !it.confirmed && openSheet(o.order_id, it)}
                      disabled={it.confirmed}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left disabled:cursor-default"
                    >
                      {it.confirmed ? (
                        <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                          <IconCheck size={18} />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-lg shrink-0">
                          {typeEmoji(it.type)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {it.product_name}{it.size_label ? ` · ${it.size_label}` : ''}
                        </p>
                        {it.confirmed ? (
                          <p className="text-xs text-emerald-600 font-medium">
                            {!isPiece(it.type)
                              ? `${it.actual_kg} kg · ${it.actual_quantity} dona`
                              : `${it.actual_quantity} dona`}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400">
                            So'ralgan: {it.requested_amount} {unitWord(it.type)}
                          </p>
                        )}
                      </div>
                      {!it.confirmed && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-slate-300 shrink-0">
                          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>

                {/* Footer: progress */}
                <div className="px-4 py-2.5 bg-slate-50/60 text-xs font-medium text-slate-500">
                  {done}/{o.items.length} tasdiqlandi
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tasdiqlash Sheet */}
      <Sheet open={!!sheet} onClose={() => setSheet(null)}>
        {sheet && (
          <div className="px-5 pt-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center text-xl shrink-0">
                {typeEmoji(sheet.item.type)}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 truncate">
                  {sheet.item.product_name}{sheet.item.size_label ? ` · ${sheet.item.size_label}` : ''}
                </h3>
                <p className="text-xs text-slate-400">
                  So'ralgan: {sheet.item.requested_amount} {unitWord(sheet.item.type)}
                </p>
              </div>
            </div>

            {!isPiece(sheet.item.type) && (
              <Input type="number" label="Necha kg chiqdi?" placeholder="Tarozida tortilgan kg"
                value={kg} onChange={(e) => setKg(e.target.value)} autoFocus />
            )}
            <Input type="number" label="Necha dona?" placeholder="Mahsulot soni"
              value={qty} onChange={(e) => setQty(e.target.value)} autoFocus={isPiece(sheet.item.type)} />

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <Button variant="success" fullWidth loading={confirm.isPending} onClick={submit}>
              Tasdiqlash
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  )
}
