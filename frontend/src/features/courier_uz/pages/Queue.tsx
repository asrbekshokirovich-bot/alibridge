import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { Header, ListSkeleton, EmptyState, StatusBadge, IconList, IconCheck, IconBox } from '@/shared/ui'

interface QueueProduct {
  barcode: string
  product_name: string
  size_label: string
  picked_up: boolean
  variant_id: number | null
  quantity: number
}

interface QueueItem {
  id: number
  carrier_name: string
  carrier_number: number | null
  address: string
  products_count: number
  status: 'pending' | 'done'
  products: QueueProduct[]
  confirmed_by_name: string | null
  created_at: string
}

export default function CourierUzQueue() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { notify, haptic } = useTelegram()
  const [error, setError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['courier-uz-queue'],
    queryFn: () => client.get<QueueItem[]>('/courier-uz/queue').then((r) => r.data),
  })

  const pickup = useMutation({
    mutationFn: (vars: { orderId: number; items: { barcode: string; variant_id: number | null; quantity: number }[] }) =>
      client.post('/courier-uz/confirm-pickup', { items: vars.items }),
    onSuccess: () => {
      notify('success')
      setError('')
      qc.invalidateQueries({ queryKey: ['courier-uz-queue'] })
    },
    onError: (err) => { setError(extractErrorMessage(err)); notify('error') },
  })

  const takeOrder = (item: QueueItem) => {
    haptic('medium')
    setError('')
    const left = item.products
      .filter((p) => !p.picked_up)
      .map((p) => ({ barcode: p.barcode, variant_id: p.variant_id, quantity: p.quantity }))
    if (left.length) {
      pickup.mutate({ orderId: item.id, items: left })
    } else {
      // Hech narsa qolmagan — yangilaymiz (boshqa kuryer olgan bo'lishi mumkin)
      setError(t('Bu buyurtmada olinadigan mahsulot qolmagan'))
      qc.invalidateQueries({ queryKey: ['courier-uz-queue'] })
    }
  }

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title={t('Yetkazish navbati')} subtitle={t("Yo'lovchilardan olish kerak")} showBack />

      {isLoading ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState icon={<IconList size={30} />} title={t("Navbat bo'sh")} description={t("Hozircha olish kerak bo'lgan yuk yo'q")} />
      ) : (
        <div className="px-4 pt-4 space-y-3 web-grid">
          {data.map((item) => {
            const done = item.status === 'done'
            const busy = pickup.isPending && pickup.variables?.orderId === item.id
            return (
              <div key={item.id} className="rounded-2xl border overflow-hidden" style={{ background: done ? 'var(--surface2)' : 'var(--surface)', borderColor: done ? 'rgba(22,163,74,0.3)' : 'var(--line)', boxShadow: 'var(--shadow-md)' }}>
                {/* Header */}
                <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--line)' }}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
                      {t("Yo'lovchi")} {item.carrier_number ? `#${item.carrier_number}` : ''}
                    </span>
                    <StatusBadge tone={done ? 'green' : 'yellow'} dot>{done ? t('Olib ketildi') : t('Kutilmoqda')}</StatusBadge>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{item.carrier_name}</p>
                  {item.address && (
                    <div className="flex items-center gap-1.5 text-xs mt-1" style={{ color: 'var(--muted)' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M12 13a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {item.address}
                    </div>
                  )}
                </div>

                {/* Mahsulotlar */}
                <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
                  {item.products.map((p) => (
                    <div key={p.barcode} className="flex items-center gap-3 px-4 py-3">
                      {p.picked_up ? (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(52,211,153,0.14)', color: '#34d399' }}>
                          <IconCheck size={18} />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(106,163,255,0.14)', color: '#6aa3ff' }}>
                          <IconBox size={18} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[14.5px] font-bold truncate" style={{ color: 'var(--ink)' }}>
                          {p.product_name}{p.size_label ? ` · ${p.size_label}` : ''}
                        </p>
                        <p className="text-[11px] font-mono" style={{ color: 'var(--muted2)' }}>{p.barcode}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer: tugma yoki tasdiqlangan */}
                {done ? (
                  <div className="px-4 py-2.5 text-xs font-semibold flex items-center gap-1.5" style={{ background: 'rgba(52,211,153,0.14)', color: '#34d399' }}>
                    <IconCheck size={14} /> {item.confirmed_by_name ? t('{{name}} tasdiqladi', { name: item.confirmed_by_name }) : t('Olib ketildi')}
                  </div>
                ) : (
                  <div className="px-4 py-3">
                    <button
                      onClick={() => takeOrder(item)}
                      disabled={busy}
                      className="press w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                      style={{ background: 'var(--royal)', boxShadow: 'var(--shadow-brand)' }}
                    >
                      {busy ? t('Olinmoqda…') : t('Olib ketdim')}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {error && (
        <div className="px-4 pt-3">
          <p className="text-sm px-4 py-3 rounded-2xl" style={{ background: 'rgba(255,107,107,0.12)', color: '#ff6b6b' }}>{error}</p>
        </div>
      )}
    </div>
  )
}
