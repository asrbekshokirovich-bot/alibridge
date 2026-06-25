import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import {
  Header, ScanInput, ListSkeleton, EmptyState, SuccessScreen,
  IconBox, IconTruck, IconChevronRight, IconCheck,
} from '@/shared/ui'

interface HandoverItem {
  product_id: number
  variant_id: number | null
  barcode: string
  product_name: string
  size_label: string
  expected_qty: number
  in_warehouse_qty: number
}

interface HandoverOrder {
  order_id: number
  carrier_name: string
  carrier_number: number | null
  pickup_type: string
  items: HandoverItem[]
  total_to_handover: number
}

interface Courier {
  id: number
  first_name: string
  last_name: string
  phone: string
}

const itemKey = (it: { barcode: string; variant_id: number | null }) => `${it.barcode}:${it.variant_id ?? 0}`
// Har yuk uchun omborda bori bilan cheklangan, topshiriladigan miqdor
const targetOf = (it: HandoverItem) => Math.min(it.expected_qty, it.in_warehouse_qty)

// ─── Kuryer tanlash (skan to'liq bo'lgach ochiladi) ─────────────────────────────
function CourierPicker({
  totalQty, busy, onPick, onCancel,
}: {
  totalQty: number
  busy: boolean
  onPick: (courierId: number) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ['warehouse-uz-couriers'],
    queryFn: () => client.get<Courier[]>('/warehouse-uz/couriers').then((r) => r.data),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={() => !busy && onCancel()}>
      <div className="w-full max-w-[480px] max-h-[85vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl p-4"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-base font-bold text-slate-900">{t('Qaysi kuryerga?')}</p>
            <p className="text-xs text-slate-500">{t('{{n}} ta yuk topshiriladi', { n: totalQty })}</p>
          </div>
          <button onClick={onCancel} disabled={busy} className="press text-sm font-semibold px-3 py-1.5 rounded-xl text-slate-500 disabled:opacity-50">
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
              <button key={c.id} onClick={() => onPick(c.id)} disabled={busy}
                className="press w-full text-left rounded-2xl p-4 border border-slate-200 flex items-center gap-3 disabled:opacity-50 bg-white">
                <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(106,163,255,0.14)', color: '#6aa3ff' }}>
                  <IconTruck size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14.5px] font-bold truncate text-slate-900">{`${c.first_name} ${c.last_name}`.trim()}</p>
                  {c.phone && <p className="text-xs text-slate-500">{c.phone}</p>}
                </div>
                <span className="shrink-0 text-slate-300"><IconChevronRight size={18} /></span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Bitta buyurtmani skanlab topshirish ────────────────────────────────────────
function OrderScan({ order, onBack, onDone }: { order: HandoverOrder; onBack: () => void; onDone: () => void }) {
  const { t } = useTranslation()
  const { notify } = useTelegram()
  const [barcode, setBarcode] = useState('')
  const [error, setError] = useState('')
  // itemKey -> skanlangan soni
  const [scanned, setScanned] = useState<Record<string, number>>({})
  // Bir xil barkod bir nechta o'lchamga to'g'ri kelsa — qaysi o'lcham ekanini so'raymiz
  const [chooseBarcode, setChooseBarcode] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  // Faqat omborda bori bilan topshiriladigan (target>0) yuklar majburiy
  const required = useMemo(() => order.items.filter((it) => targetOf(it) > 0), [order.items])
  const allScanned = required.length > 0 && required.every((it) => (scanned[itemKey(it)] ?? 0) >= targetOf(it))
  const totalScanned = required.reduce((s, it) => s + Math.min(scanned[itemKey(it)] ?? 0, targetOf(it)), 0)

  const addOne = (it: HandoverItem) => {
    const k = itemKey(it)
    const cur = scanned[k] ?? 0
    if (cur >= targetOf(it)) {
      notify('warning')
      setError(t('{{name}}: to\'liq skanlandi', { name: it.product_name }))
      return
    }
    setScanned((p) => ({ ...p, [k]: cur + 1 }))
    setError('')
    notify('success')
  }

  const handleScan = (raw: string) => {
    const bc = raw.trim()
    if (!bc) return
    setError('')
    // Shu barkodga mos, hali to'lmagan yuklar
    const matches = required.filter((it) => it.barcode === bc && (scanned[itemKey(it)] ?? 0) < targetOf(it))
    if (matches.length === 0) {
      // Buyurtmada bormi umuman?
      const inOrder = order.items.some((it) => it.barcode === bc)
      notify('error')
      setError(inOrder ? t('{{bc}}: bu yuk to\'liq skanlandi', { bc }) : t('{{bc}}: bu buyurtmada yo\'q', { bc }))
      return
    }
    if (matches.length === 1) {
      addOne(matches[0])
    } else {
      // Ko'p o'lcham — qaysi biriga ekanini so'raymiz
      setChooseBarcode(bc)
    }
  }

  const confirm = useMutation({
    mutationFn: (courierId: number) =>
      client.post('/warehouse-uz/confirm-courier-handover', {
        courier_id: courierId,
        items: required.map((it) => ({
          barcode: it.barcode,
          variant_id: it.variant_id,
          quantity: targetOf(it),
        })),
      }),
    onSuccess: () => { notify('success'); setPickerOpen(false); onDone() },
    onError: (err) => { setError(extractErrorMessage(err)); setPickerOpen(false); notify('error') },
  })

  const chooseItems = chooseBarcode
    ? required.filter((it) => it.barcode === chooseBarcode && (scanned[itemKey(it)] ?? 0) < targetOf(it))
    : []

  return (
    <div className="min-h-screen flex flex-col animate-fade-in">
      <Header
        title={t('Buyurtma #{{n}}', { n: order.order_id })}
        subtitle={`${order.carrier_name}${order.carrier_number ? ` · #${order.carrier_number}` : ''}`}
        showBack onBack={onBack}
      />

      <ScanInput value={barcode} onChange={setBarcode} onScan={handleScan} placeholder={t('Yuk barkodini skanlang')} />

      {error && (
        <div className="mx-4 -mt-1 mb-2 bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-xl animate-fade-in">{error}</div>
      )}

      {/* Progress */}
      <div className="px-4 pb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-slate-700">{t('Skanlandi')}</span>
        <span className="text-sm font-bold px-2.5 py-0.5 rounded-full text-white" style={{ background: 'var(--brand-gradient)' }}>
          {totalScanned} / {order.total_to_handover}
        </span>
      </div>

      {/* Checklist */}
      <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-36">
        {order.items.map((it) => {
          const target = targetOf(it)
          const got = Math.min(scanned[itemKey(it)] ?? 0, target)
          const unavailable = target === 0
          const complete = !unavailable && got >= target
          return (
            <div key={itemKey(it)}
              className={`rounded-2xl p-3.5 border flex items-center gap-3 ${
                unavailable ? 'border-slate-200 bg-slate-50 opacity-60'
                : complete ? 'border-emerald-200 bg-emerald-50/40'
                : 'border-slate-200 bg-white'}`}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0">
                {complete
                  ? <span className="bg-emerald-100 text-emerald-600 w-full h-full rounded-full flex items-center justify-center"><IconCheck size={18} /></span>
                  : <span className="bg-slate-100 text-slate-400 w-full h-full rounded-full flex items-center justify-center"><IconBox size={18} /></span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-slate-900 truncate">
                  {it.product_name}{it.size_label ? ` · ${it.size_label}` : ''}
                </p>
                <p className="text-xs font-mono text-slate-400">
                  {it.barcode}
                  {unavailable && <span className="text-red-500"> · {t('omborda yo\'q')}</span>}
                </p>
              </div>
              {!unavailable && (
                <span className={`text-sm font-bold shrink-0 ${complete ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {got} / {target}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Topshirish — faqat hammasi skanlangach */}
      {allScanned && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100">
          <button onClick={() => setPickerOpen(true)} disabled={confirm.isPending}
            style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
            className="press w-full text-white rounded-2xl py-4 font-bold shadow-[0_8px_24px_rgba(34,197,94,0.35)] disabled:opacity-50">
            {confirm.isPending ? t('Yuklanmoqda...') : t('Topshirish ({{n}} ta)', { n: totalScanned })}
          </button>
        </div>
      )}

      {/* O'lcham tanlash (bir barkod, bir nechta o'lcham) */}
      {chooseBarcode && chooseItems.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={() => setChooseBarcode(null)}>
          <div className="w-full max-w-[480px] bg-white rounded-t-3xl sm:rounded-3xl p-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold text-slate-900 mb-1">{t('Qaysi o\'lcham?')}</p>
            <p className="text-xs text-slate-500 mb-3 font-mono">{chooseBarcode}</p>
            <div className="flex flex-wrap gap-2">
              {chooseItems.map((it) => (
                <button key={itemKey(it)}
                  onClick={() => { addOne(it); setChooseBarcode(null) }}
                  className="press px-3 py-2 rounded-xl border border-amber-300 text-sm font-semibold text-amber-700 bg-white">
                  {it.size_label || t('O\'lcham')} · {scanned[itemKey(it)] ?? 0}/{targetOf(it)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {pickerOpen && (
        <CourierPicker
          totalQty={totalScanned}
          busy={confirm.isPending}
          onCancel={() => setPickerOpen(false)}
          onPick={(courierId) => confirm.mutate(courierId)}
        />
      )}
    </div>
  )
}

// ─── Asosiy: buyurtmalar ro'yxati → buyurtmani skanlab topshirish ────────────────
export default function HandoverCourier() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [order, setOrder] = useState<HandoverOrder | null>(null)
  const [done, setDone] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['warehouse-uz-handover-orders'],
    queryFn: () => client.get<HandoverOrder[]>('/warehouse-uz/handover-orders').then((r) => r.data),
    enabled: !order && !done,
  })

  if (done) {
    return (
      <SuccessScreen
        title={t('Topshirildi!')}
        description={t('Yuk kuryerga topshirildi.')}
      />
    )
  }

  if (order) {
    return (
      <OrderScan
        order={order}
        onBack={() => setOrder(null)}
        onDone={() => {
          setOrder(null)
          setDone(true)
          qc.invalidateQueries({ queryKey: ['warehouse-uz-handover-orders'] })
        }}
      />
    )
  }

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title={t('Kuryerga topshirish')} subtitle={t('Buyurtmani tanlang')} showBack />

      {isLoading ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState icon={<IconBox size={30} />} title={t('Buyurtma yo\'q')} description={t('Topshirishga tayyor buyurtma topilmadi')} />
      ) : (
        <div className="px-4 pt-4 space-y-2 web-grid">
          {data.map((o) => (
            <button key={o.order_id} onClick={() => setOrder(o)}
              className="press w-full text-left rounded-2xl p-4 border flex items-center gap-3"
              style={{ background: 'var(--card-gradient)', borderColor: 'var(--line2)', boxShadow: 'var(--shadow-md)' }}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(106,163,255,0.14)', color: '#6aa3ff' }}>
                <IconBox size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14.5px] font-bold truncate" style={{ color: 'var(--ink)' }}>
                  {t('Buyurtma #{{n}}', { n: o.order_id })}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {o.carrier_name}{o.carrier_number ? ` · #${o.carrier_number}` : ''} · {t('{{n}} ta yuk', { n: o.total_to_handover })}
                </p>
              </div>
              <span className="shrink-0" style={{ color: 'var(--muted3)' }}><IconChevronRight size={18} /></span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
