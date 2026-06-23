import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import {
  Header, Button, Input, Textarea, ScanInput, Sheet, SuccessScreen,
  ListSkeleton, EmptyState, IconBox, IconAlert, IconCheck, IconPlane,
} from '@/shared/ui'

interface CarrierProduct {
  product_id: number
  variant_id: number
  barcode: string
  product_name: string
  category: string
  image_url: string | null
  size_label: string
  quantity: number
}

// Bir qator holati: yo'lovchidagi yuk + skanlangan/zararlangan belgisi
interface Row extends CarrierProduct {
  scanned: number   // skanlangan dona (0 = qizil)
  damaged: boolean  // zarar deb belgilangan
}

const keyOf = (p: { barcode: string; variant_id: number }) => `${p.barcode}:${p.variant_id}`

export default function ReceiveFromUZ() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { notify, haptic } = useTelegram()

  const [carrierNumber, setCarrierNumber] = useState('')
  const [started, setStarted] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [barcode, setBarcode] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  // Zarar modal
  const [damageRow, setDamageRow] = useState<Row | null>(null)
  const [damageNote, setDamageNote] = useState('')

  const cn = parseInt(carrierNumber, 10)
  const validCn = !!carrierNumber && !isNaN(cn) && cn > 0

  // Yo'lovchi yuklarini yuklash
  const { isLoading, isError, error: loadError } = useQuery({
    queryKey: ['courier-tr-carrier-products', cn],
    enabled: started && validCn,
    queryFn: () =>
      client.get<CarrierProduct[]>('/courier-tr/carrier-products', { params: { carrier_number: cn } })
        .then((r) => {
          setRows(r.data.map((p) => ({ ...p, scanned: 0, damaged: false })))
          return r.data
        }),
  })

  const okRows = rows.filter((r) => r.scanned > 0 && !r.damaged)
  const totalOk = useMemo(() => okRows.reduce((s, r) => s + r.scanned, 0), [okRows])

  // Skan — barkodga mos qatorni topib, skanlangan miqdorni +1 (cheklov: quantity)
  const handleScan = (raw: string) => {
    const bc = raw.trim()
    if (!bc) return
    setError('')
    const matching = rows.filter((r) => r.barcode === bc && !r.damaged)
    if (matching.length === 0) {
      const isDamaged = rows.some((r) => r.barcode === bc && r.damaged)
      notify('error')
      setError(isDamaged
        ? t('{{bc}}: bu yuk zarar deb belgilangan', { bc })
        : t('{{bc}}: bu yo\'lovchida bunday yuk yo\'q', { bc }))
      return
    }
    // Bir barkod ko'p o'lchamli bo'lsa — to'lmagan birinchi qatorga qo'shamiz
    const target = matching.find((r) => r.scanned < r.quantity)
    if (!target) {
      notify('warning')
      setError(t('{{bc}}: hammasi skanlangan', { bc }))
      return
    }
    haptic('light')
    notify('success')
    setRows((prev) => prev.map((r) =>
      keyOf(r) === keyOf(target) ? { ...r, scanned: Math.min(r.scanned + 1, r.quantity) } : r,
    ))
  }

  // Zarar modalni ochish (qizil qatordan)
  const openDamage = (row: Row) => {
    haptic('medium')
    setDamageNote('')
    setError('')
    setDamageRow(row)
  }

  const damageMutation = useMutation({
    mutationFn: (row: Row) => client.post('/courier-tr/report-damaged', {
      carrier_number: cn,
      barcode: row.barcode,
      note: damageNote,
    }),
    onSuccess: (_, row) => {
      notify('success')
      setRows((prev) => prev.map((r) =>
        keyOf(r) === keyOf(row) ? { ...r, damaged: true, scanned: 0 } : r,
      ))
      setDamageRow(null)
    },
    onError: (err) => { setError(extractErrorMessage(err)); notify('error') },
  })

  const confirm = useMutation({
    mutationFn: () => client.post('/courier-tr/confirm-receive', {
      carrier_number: cn,
      items: okRows.map((r) => ({ barcode: r.barcode, variant_id: r.variant_id, quantity: r.scanned })),
    }),
    onSuccess: () => { notify('success'); setDone(true) },
    onError: (err) => { setError(extractErrorMessage(err)); notify('error') },
  })

  // === Yakuniy ekran ===
  if (done) {
    return <SuccessScreen
      title={t('Qabul qilindi!')}
      description={t('{{n}} ta mahsulot sizga (kuryerga) o\'tdi.', { n: totalOk })}
      action={<Button fullWidth onClick={() => navigate('/courier-tr')}>{t('Bosh sahifa')}</Button>}
    />
  }

  // === 1-bosqich: yo'lovchi raqami ===
  if (!started) {
    return (
      <div className="min-h-screen animate-fade-in">
        <Header title={t('Yo\'lovchidan qabul')} showBack onBack={() => navigate('/courier-tr')} />
        <form className="px-5 pt-8" onSubmit={(e) => { e.preventDefault(); if (validCn) { haptic('medium'); setStarted(true) } }}>
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-white mb-3" style={{ background: 'var(--brand-gradient)' }}>
              <IconPlane size={30} />
            </div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('Yo\'lovchi raqami')}</h2>
            <p className="text-sm text-center mt-1" style={{ color: 'var(--muted)' }}>{t('Yo\'lovchining tartib raqamini kiriting')}</p>
          </div>
          <Input type="number" inputMode="numeric" autoFocus placeholder={t('Masalan: 47')}
            className="text-center text-lg font-bold"
            value={carrierNumber} onChange={(e) => setCarrierNumber(e.target.value)} />
          <Button type="submit" fullWidth className="mt-4" disabled={!validCn}>{t('Davom etish')}</Button>
        </form>
      </div>
    )
  }

  // === 2-bosqich: ro'yxat + skan + zarar ===
  return (
    <div className="min-h-screen flex flex-col animate-fade-in">
      <Header title={t('Yo\'lovchi #{{carrierNumber}}', { carrierNumber })}
        subtitle={t('Yuklarni skanlang')} showBack onBack={() => { setStarted(false); setRows([]) }} />

      <ScanInput value={barcode} onChange={setBarcode} onScan={handleScan} />

      {error && (
        <div className="mx-4 -mt-1 mb-2 text-sm px-4 py-2.5 rounded-xl animate-fade-in" style={{ background: 'rgba(255,107,107,0.12)', color: '#ff6b6b' }}>{error}</div>
      )}

      {isLoading ? (
        <ListSkeleton />
      ) : isError ? (
        <div className="px-4 pt-2">
          <p className="text-sm px-4 py-3 rounded-2xl" style={{ background: 'rgba(255,107,107,0.12)', color: '#ff6b6b' }}>{extractErrorMessage(loadError)}</p>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<IconBox size={30} />} title={t('Yuk yo\'q')}
          description={t('Bu yo\'lovchida hozir yuk yo\'q')} />
      ) : (
        <>
          {/* Sanagich */}
          <div className="px-4 pb-2 flex items-center justify-between">
            <span className="text-sm font-bold" style={{ color: 'var(--muted)' }}>{t('Skanlandi')}</span>
            <span className="text-sm font-bold px-2.5 py-0.5 rounded-full text-white" style={{ background: 'var(--brand-gradient)' }}>
              {t('{{n}} / {{total}}', { n: totalOk, total: rows.reduce((s, r) => s + r.quantity, 0) })}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-32 web-grid">
            {rows.map((r) => {
              const fullyScanned = r.scanned >= r.quantity && !r.damaged
              const isRed = r.scanned === 0 && !r.damaged
              const tile = r.damaged
                ? { background: 'var(--surface)', borderColor: 'var(--line)', opacity: 0.6 }
                : fullyScanned
                ? { background: 'rgba(52,211,153,0.10)', borderColor: 'rgba(52,211,153,0.35)' }
                : isRed
                ? { background: 'rgba(255,107,107,0.10)', borderColor: 'rgba(255,107,107,0.30)' }
                : { background: 'rgba(251,191,36,0.10)', borderColor: 'rgba(251,191,36,0.30)' }
              return (
                <button
                  key={keyOf(r)}
                  type="button"
                  disabled={r.damaged || !isRed}
                  onClick={() => isRed && openDamage(r)}
                  className={`w-full text-left rounded-2xl p-3.5 border flex items-center gap-3 animate-scale-in ${isRed ? 'press' : ''}`}
                  style={tile}
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border" style={{ background: 'rgba(106,163,255,0.14)', color: '#6aa3ff', borderColor: 'var(--line)' }}>
                    {r.image_url ? <img src={r.image_url} alt="" className="w-full h-full object-cover" /> : <IconBox size={22} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[14.5px] truncate" style={{ color: 'var(--ink)' }}>
                      {r.product_name}{r.size_label ? ` · ${r.size_label}` : ''}
                    </p>
                    <p className="text-[11px] font-mono" style={{ color: 'var(--muted2)' }}>{r.barcode}</p>
                    {r.damaged ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold mt-1" style={{ color: 'var(--muted)' }}>
                        <IconAlert size={13} /> {t('Zarar — qabul qilinmadi')}
                      </span>
                    ) : isRed ? (
                      <span className="text-xs font-medium mt-0.5 inline-block" style={{ color: 'var(--red)' }}>
                        {t('Skanlanmagan · zarar uchun bosing')}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold mt-0.5 inline-block" style={{ color: 'var(--green)' }}>
                        {t('Skanlandi: {{n}} / {{q}}', { n: r.scanned, q: r.quantity })}
                      </span>
                    )}
                  </div>
                  <div className="shrink-0">
                    {r.damaged ? (
                      <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--line2)', color: 'var(--muted)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
                      </span>
                    ) : fullyScanned ? (
                      <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.14)', color: '#34d399' }}><IconCheck size={18} /></span>
                    ) : (
                      <span className="text-xs font-bold text-white px-2 py-1 rounded-lg" style={{ background: 'var(--royal)' }}>
                        {t('{{n}} ta', { n: r.quantity })}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Tasdiqlash */}
      {okRows.length > 0 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 backdrop-blur-xl border-t" style={{ background: 'rgba(10,16,32,0.80)', borderColor: 'var(--line)' }}>
          <button onClick={() => confirm.mutate()} disabled={confirm.isPending}
            style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
            className="press w-full text-white rounded-2xl py-4 font-bold shadow-[0_8px_24px_rgba(34,197,94,0.35)] disabled:opacity-50">
            {confirm.isPending ? t('Yuklanmoqda...') : t('Qabul qilish ({{n}} ta)', { n: totalOk })}
          </button>
        </div>
      )}

      {/* Zarar modal */}
      <Sheet open={!!damageRow} onClose={() => setDamageRow(null)}>
        {damageRow && (
          <div className="px-5 pb-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,107,107,0.14)', color: '#ff6b6b' }}><IconAlert size={22} /></div>
              <div>
                <h3 className="font-bold" style={{ color: 'var(--ink)' }}>{t('Zarar yetgan yuk')}</h3>
                <p className="text-xs font-mono" style={{ color: 'var(--muted2)' }}>{damageRow.barcode}</p>
              </div>
            </div>
            <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
              {damageRow.product_name}{damageRow.size_label ? ` · ${damageRow.size_label}` : ''}
            </p>
            <Textarea label={t('Izoh (report)')} placeholder={t('Nima bo\'lgani haqida')} rows={3}
              value={damageNote} onChange={(e) => setDamageNote(e.target.value)} />
            <div className="flex gap-2 mt-4">
              <Button variant="ghost" fullWidth onClick={() => setDamageRow(null)}>{t('Bekor')}</Button>
              <Button variant="danger" fullWidth loading={damageMutation.isPending}
                onClick={() => damageMutation.mutate(damageRow)}>
                {t('Zarar deb belgilash')}
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}
