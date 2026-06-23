import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { useAuthStore } from '@/shared/store/auth'
import { Header, ListSkeleton, IconHandshake, IconBox } from '@/shared/ui'

interface PendingItem {
  barcode: string
  product_name: string
  image_url: string | null
  size_label: string
  quantity: number
}

interface PendingHandover {
  id: number
  courier_name: string
  total: number
  created_at: string
  items: PendingItem[]
}

export default function AutoReceive() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { notify, haptic } = useTelegram()
  const user = useAuthStore((s) => s.user)
  const carrierNumber = user?.carrier_number

  const [address, setAddress] = useState('')
  const [flightNumber, setFlightNumber] = useState('')
  const [flightDate, setFlightDate] = useState('')
  const [error, setError] = useState('')

  const { data: pendings, isLoading } = useQuery({
    queryKey: ['carrier-pending-handovers'],
    queryFn: () => client.get<PendingHandover[]>('/carrier/pending-handovers').then((r) => r.data),
    refetchInterval: 15000,
  })

  const confirm = useMutation({
    mutationFn: (pendingId: number) =>
      client.post('/carrier/confirm-handover', {
        pending_id: pendingId,
        delivery_address_tr: address.trim(),
        flight_number: flightNumber.trim(),
        flight_date: flightDate || null,
      }),
    onSuccess: () => {
      notify('success')
      setError(''); setAddress(''); setFlightNumber(''); setFlightDate('')
      qc.invalidateQueries({ queryKey: ['carrier-pending-handovers'] })
      qc.invalidateQueries({ queryKey: ['carrier-my-products'] })
    },
    onError: (err) => { setError(extractErrorMessage(err)); notify('error') },
  })

  const valid = address.trim().length > 0 && flightNumber.trim().length > 0
  const hasPending = (pendings?.length ?? 0) > 0

  return (
    <div className="min-h-screen pb-28 animate-fade-in">
      <Header title={t('Kuryerdan qabul')} subtitle={t("Raqamingizni kuryerga ko'rsating")} />

      {isLoading ? (
        <ListSkeleton />
      ) : hasPending ? (
        <div className="px-4 pt-4 space-y-4">
          {/* Manzil + reys formi (barcha pendinglar uchun bitta) */}
          <div className="rounded-2xl p-4 bg-white border border-slate-100 shadow-sm space-y-3">
            <p className="text-sm font-bold text-slate-900">{t('Qabuldan oldin maʼlumotlarni kiriting')}</p>
            <div>
              <label className="text-xs font-semibold text-slate-500">{t('Turkiyadagi manzil')}</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t('Yukni olib ketish manzili')}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-semibold text-slate-500">{t('Reys raqami')}</label>
                <input
                  value={flightNumber}
                  onChange={(e) => setFlightNumber(e.target.value)}
                  placeholder="TK1234"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-slate-500">{t('Uchish sanasi')}</label>
                <input
                  type="date"
                  value={flightDate}
                  onChange={(e) => setFlightDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Pending topshiriqlar */}
          {pendings!.map((p) => {
            const busy = confirm.isPending && confirm.variables === p.id
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
                  <div>
                    <span className="text-sm font-bold text-slate-900">{t('Kuryer topshirmoqchi')}</span>
                    {p.courier_name && <p className="text-xs text-slate-400 mt-0.5">{p.courier_name}</p>}
                  </div>
                  <span className="text-xs font-bold text-white px-2.5 py-0.5 rounded-full" style={{ background: 'var(--brand)' }}>
                    {t('{{n}} ta', { n: p.total })}
                  </span>
                </div>

                <div className="divide-y divide-slate-50">
                  {p.items.map((it) => (
                    <div key={`${it.barcode}:${it.size_label}`} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border"
                        style={{ background: 'var(--card-2)', borderColor: 'var(--border)', color: 'var(--text-dim)' }}>
                        {it.image_url ? <img src={it.image_url} alt="" className="w-full h-full object-cover" /> : <IconBox size={16} />}
                      </div>
                      <span className="flex-1 text-sm text-slate-700 truncate">
                        {it.product_name}{it.size_label ? ` · ${it.size_label}` : ''}
                      </span>
                      <span className="text-xs text-slate-400 shrink-0">{t('{{n}} ta', { n: it.quantity })}</span>
                    </div>
                  ))}
                </div>

                <div className="px-4 py-3">
                  <button
                    onClick={() => { haptic('medium'); setError(''); confirm.mutate(p.id) }}
                    disabled={busy || !valid}
                    className="press w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                    style={{ background: 'var(--brand-gradient)' }}
                  >
                    {busy ? t('Tasdiqlanmoqda…') : t('Qabul qildim')}
                  </button>
                  {!valid && (
                    <p className="text-[11px] text-slate-400 text-center mt-2">
                      {t('Avval manzil va reys raqamini kiriting')}
                    </p>
                  )}
                </div>
              </div>
            )
          })}

          {error && (
            <p className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl">{error}</p>
          )}
        </div>
      ) : (
        <>
          {/* Info banner */}
          <div className="px-4 pt-4">
            <div className="rounded-2xl p-4 flex gap-3 border" style={{ background: 'var(--brand-tint)', borderColor: 'var(--brand-tint-border)' }}>
              <div className="shrink-0" style={{ color: 'var(--brand-light)' }}><IconHandshake size={22} /></div>
              <p className="text-[13px] leading-snug" style={{ color: 'var(--text-2)' }}>
                {t('Aeroportда kuryerga quyidagi raqamingizni ayting. Kuryer barkodlarni skanlab, yuklaringizni sizga topshiradi.')}
              </p>
            </div>
          </div>

          {/* Yo'lovchi raqami — katta ko'rinishda */}
          <div className="px-4 pt-8 flex flex-col items-center">
            {carrierNumber ? (
              <>
                <p className="text-sm text-slate-500 mb-2">{t("Sizning yo'lovchi raqamingiz")}</p>
                <div
                  className="w-40 h-40 rounded-[2rem] flex items-center justify-center text-white shadow-[var(--shadow-brand)]"
                  style={{ background: 'var(--brand-gradient)' }}
                >
                  <span className="text-6xl font-extrabold tracking-tight">#{carrierNumber}</span>
                </div>
                <p className="text-[13px] text-slate-400 mt-5 text-center max-w-[260px]">
                  {t('Kuryer raqamingizni kiritib yuklarni skanlaydi. Keyin shu yerda manzil va reysni kiritib qabulni tasdiqlaysiz.')}
                </p>
              </>
            ) : (
              <p className="text-slate-500 text-sm text-center mt-10">
                {t("Yo'lovchi raqamingiz hali tayinlanmagan. Iltimos, qaytadan kiring.")}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
