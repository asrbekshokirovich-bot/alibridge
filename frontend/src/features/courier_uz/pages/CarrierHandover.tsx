import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { Header, ListSkeleton, EmptyState, IconBox } from '@/shared/ui'

interface MyProduct {
  product_id: number
  variant_id: number
  barcode: string
  product_name: string
  category: string
  image_url: string | null
  carrier_name: string | null
  carrier_number: number | null
  picked_up_at: string
  size_label: string
  quantity: number
}

// Buyurtmali yuklar yo'lovchi raqami bo'yicha guruhlanadi
interface CarrierGroup {
  carrier_number: number
  carrier_name: string | null
  items: MyProduct[]
  total: number
}

function groupByCarrier(products: MyProduct[]): CarrierGroup[] {
  const map = new Map<number, CarrierGroup>()
  for (const p of products) {
    // Faqat buyurtmali (yo'lovchi raqami bor) yuklar — buyurtmasizlar aeroport oqimida
    if (p.carrier_number == null) continue
    const g = map.get(p.carrier_number)
    if (g) {
      g.items.push(p)
      g.total += p.quantity
    } else {
      map.set(p.carrier_number, {
        carrier_number: p.carrier_number,
        carrier_name: p.carrier_name,
        items: [p],
        total: p.quantity,
      })
    }
  }
  return [...map.values()].sort((a, b) => a.carrier_number - b.carrier_number)
}

export default function CourierUzCarrierHandover() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { notify, haptic } = useTelegram()
  const [error, setError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['courier-uz-my-products'],
    queryFn: () => client.get<MyProduct[]>('/courier-uz/my-products').then((r) => r.data),
  })

  const handover = useMutation({
    mutationFn: (g: CarrierGroup) =>
      client.post('/courier-uz/confirm-airport', {
        carrier_number: g.carrier_number,
        items: g.items.map((p) => ({ barcode: p.barcode, variant_id: p.variant_id, quantity: p.quantity })),
      }),
    onSuccess: () => {
      notify('success')
      setError('')
      qc.invalidateQueries({ queryKey: ['courier-uz-my-products'] })
    },
    onError: (err) => { setError(extractErrorMessage(err)); notify('error') },
  })

  const groups = groupByCarrier(data ?? [])

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title={t("Yo'lovchiga topshirish")} subtitle={t('Buyurtma yuklarini egasiga bering')}
        showBack onBack={() => navigate('/courier-uz')} />

      {isLoading ? (
        <ListSkeleton />
      ) : !groups.length ? (
        <EmptyState icon={<IconBox size={30} />} title={t("Topshiriladigan yuk yo'q")}
          description={t("Buyurtma bo'yicha olingan yuklaringiz yo'q. Buyurtmadan tashqari yuklarni 'Aeroportда topshirish' orqali bering.")} />
      ) : (
        <div className="px-4 pt-4 space-y-3 web-grid">
          {groups.map((g) => {
            const busy = handover.isPending && handover.variables?.carrier_number === g.carrier_number
            return (
              <div key={g.carrier_number} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Yo'lovchi sarlavhasi */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
                  <div>
                    <span className="text-sm font-bold text-slate-900">{t("Yo'lovchi #{{n}}", { n: g.carrier_number })}</span>
                    {g.carrier_name && <p className="text-xs text-slate-400 mt-0.5">{g.carrier_name}</p>}
                  </div>
                  <span className="text-xs font-bold text-white px-2.5 py-0.5 rounded-full" style={{ background: 'var(--brand)' }}>
                    {t('{{n}} ta', { n: g.total })}
                  </span>
                </div>

                {/* Yuklar */}
                <div className="divide-y divide-slate-50">
                  {g.items.map((p) => (
                    <div key={`${p.product_id}:${p.size_label}`} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-base shrink-0 overflow-hidden">
                        {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : '📦'}
                      </div>
                      <span className="flex-1 text-sm text-slate-700 truncate">
                        {p.product_name}{p.size_label ? ` · ${p.size_label}` : ''}
                      </span>
                      <span className="text-xs text-slate-400 shrink-0">{t('{{n}} ta', { n: p.quantity })}</span>
                    </div>
                  ))}
                </div>

                {/* Topshirish tugmasi */}
                <div className="px-4 py-3">
                  <button onClick={() => { haptic('medium'); setError(''); handover.mutate(g) }}
                    disabled={busy}
                    className="press w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                    style={{ background: 'var(--brand-gradient)' }}>
                    {busy ? t('Topshirilmoqda…') : t('Topshirdim')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {error && (
        <div className="px-4 pt-3">
          <p className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl">{error}</p>
        </div>
      )}
    </div>
  )
}
