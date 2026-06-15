import { useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { Header } from './Header'
import { ScanInput } from './ScanInput'
import { SuccessScreen } from './States'
import { IconCheck } from './icons'

interface VariantAvailability {
  variant_id: number
  size_label: string
  available: number
}

interface ScanData {
  barcode: string
  product_name: string
  available_by_variant?: VariantAvailability[]
  [key: string]: unknown
}

// Qator holati: pending (server javobi kutilmoqda) | ok | error | choose (ko'p o'lcham)
type RowStatus = 'pending' | 'ok' | 'error' | 'choose'

// Skanlangan qator — key bo'yicha kalitlangan (optimistik: darhol qo'shiladi,
// mahsulot ma'lumoti fonда to'ldiriladi).
// key: pending/error/choose uchun barkod; ok uchun `${barcode}:${variant_id}` —
// shunda bir mahsulotning bir nechta o'lchami alohida qator bo'la oladi.
interface ScannedRow {
  key: string
  barcode: string
  product_name: string
  variant_id: number | null   // server aniqlagach to'ladi (1 variantli yoki tanlangach)
  size_label: string
  available: number           // manbada bori (server javobidan); 0 = noma'lum
  quantity: number
  status: RowStatus
  error?: string              // xato matni (status=error)
  variants?: VariantAvailability[] // status=choose bo'lsa tanlash uchun
  multiVariant?: boolean      // mahsulot ko'p o'lchamli — qayta skan o'lcham tanlashni so'raydi
}

const okKey = (barcode: string, variantId: number) => `${barcode}:${variantId}`

interface Props {
  title: string
  subtitle?: string
  scanUrl: string
  confirmUrl: string
  scanBody?: Record<string, unknown>
  confirmBody?: Record<string, unknown>
  successTitle: string
  successDesc?: (count: number) => string
  showBack?: boolean
  onBack?: () => void
}

// Miqdor bo'yicha skanlash sessiyasi (split custody) — optimistik live rejim:
// pistolet tezligida skan darhol ro'yxatga tushadi, tekshiruv fonда parallel ketadi.
export function ScanSession({
  title, subtitle, scanUrl, confirmUrl, scanBody = {}, confirmBody = {},
  successTitle, successDesc, showBack, onBack,
}: Props) {
  const { t } = useTranslation()
  const { notify } = useTelegram()
  const [barcode, setBarcode] = useState('')
  const [rows, setRows] = useState<ScannedRow[]>([])
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  // Fonда tekshirilayotgan (hali javob kelmagan) skanlar soni
  const [checking, setChecking] = useState(0)
  const checkingRef = useRef(0)
  // rows'ning joriy nusxasi — handleScan'da sinxron qaror qabul qilish uchun
  // (setRows updater keyinroq ishlaydi, undan needVerify'ni o'qib bo'lmaydi)
  const rowsRef = useRef<ScannedRow[]>([])
  const setRowsSync = useCallback((fn: (prev: ScannedRow[]) => ScannedRow[]) => {
    rowsRef.current = fn(rowsRef.current)
    setRows(rowsRef.current)
  }, [])

  // Faqat tasdiqqa tayyor (ok) qatorlar hisobga olinadi
  const validRows = rows.filter((r) => r.status === 'ok')
  const totalQty = validRows.reduce((s, r) => s + r.quantity, 0)
  const hasErrors = rows.some((r) => r.status === 'error')
  const hasChoose = rows.some((r) => r.status === 'choose')   // o'lcham tanlanmagan
  const hasPending = rows.some((r) => r.status === 'pending') // hali tekshirilmoqda

  const bump = (delta: number) => {
    checkingRef.current = Math.max(0, checkingRef.current + delta)
    setChecking(checkingRef.current)
  }

  // Bir barkod uchun fonда tekshiruv: server'dan nom/o'lcham/available oladi.
  const verify = useCallback(async (bc: string) => {
    bump(1)
    try {
      const { data } = await client.post<ScanData>(scanUrl, { barcode: bc, ...scanBody })
      const variants = data.available_by_variant ?? []
      let clipped = false
      setRowsSync((prev) => {
        // Pending qatorni (key === bc) topib holatini yangilaymiz
        const pend = prev.find((r) => r.key === bc && r.status === 'pending')
        if (!pend) return prev

        if (variants.length === 0) {
          return prev.map((r) =>
            r.key === bc && r.status === 'pending'
              ? { ...r, status: 'error', error: t('qolmagan'), product_name: data.product_name || bc }
              : r,
          )
        }
        if (variants.length === 1) {
          const v = variants[0]
          const key = okKey(bc, v.variant_id)
          // Shu barkod+variant allaqachon ok qator sifatida bormi? — birlashtiramiz
          const existingOk = prev.find((r) => r.key === key && r.status === 'ok')
          const wanted = pend.quantity + (existingOk ? existingOk.quantity : 0)
          const finalQty = Math.min(wanted, v.available)
          if (finalQty < wanted) clipped = true
          // Pending qatorni olib tashlab, ok qatorni yangilaymiz/yaratamiz
          const withoutPend = prev.filter((r) => r.key !== bc)
          if (existingOk) {
            return withoutPend.map((r) => (r.key === key ? { ...r, quantity: finalQty, available: v.available } : r))
          }
          return [
            { ...pend, key, status: 'ok', product_name: data.product_name, variant_id: v.variant_id, size_label: v.size_label, available: v.available, quantity: finalQty },
            ...withoutPend.filter((r) => r.key !== bc),
          ]
        }
        // Ko'p o'lcham — foydalanuvchi tanlaydi (multiVariant: qayta skanда yana so'raladi)
        return prev.map((r) =>
          r.key === bc && r.status === 'pending'
            ? { ...r, status: 'choose', product_name: data.product_name, variants, multiVariant: true }
            : r,
        )
      })
      if (variants.length === 0) notify('error')
      else if (clipped) { notify('warning'); setError(t('{{bc}}: omborda kamroq qoldi, miqdor moslandi', { bc })) }
      else notify('success')
    } catch (err) {
      const msg = extractErrorMessage(err)
      setRowsSync((prev) =>
        prev.map((r) =>
          r.key === bc && r.status === 'pending' ? { ...r, status: 'error', error: msg } : r,
        ),
      )
      notify('error')
    } finally {
      bump(-1)
    }
  }, [scanUrl, scanBody, notify, setRowsSync])

  // Pistolet/qo'lda skan — DARHOL ro'yxatga qo'shamiz (kutishsiz), tekshiruv fonда.
  // Qaror rowsRef bo'yicha SINXRON qabul qilinadi (setRows updater keyin ishlaydi).
  const handleScan = (raw: string) => {
    const bc = raw.trim()
    if (!bc) return
    setError('')
    // Shu barkodning har qanday holatdagi qatori (pending key=bc, yoki ok key=bc:variant)
    const rowsOfBc = rowsRef.current.filter((r) => r.barcode === bc)
    const pendingOrChoose = rowsOfBc.find((r) => r.status === 'pending' || r.status === 'choose')
    const errored = rowsOfBc.find((r) => r.status === 'error')
    const okRows = rowsOfBc.filter((r) => r.status === 'ok')
    const isMulti = rowsOfBc.some((r) => r.multiVariant)
    let needVerify = false

    if (pendingOrChoose) {
      // Hali tekshirilmoqda / o'lcham tanlanmagan — pending bo'lsa +1, choose bo'lsa kutamiz
      if (pendingOrChoose.status === 'pending') {
        setRowsSync((prev) =>
          prev.map((r) => (r.key === bc && r.status === 'pending' ? { ...r, quantity: r.quantity + 1 } : r)),
        )
      }
      // choose: o'lcham tanlanishini kutamiz, +1 qo'shmaymiz
    } else if (isMulti) {
      // Ko'p o'lchamli mahsulot qayta skanlandi — qaysi o'lcham ekani noma'lum,
      // yangi choose ochamiz (avtomatik +1 qilmaymiz). Variantlar mavjud qatordan.
      const known = rowsOfBc.find((r) => r.variants && r.variants.length > 0)
      needVerify = !known
      setRowsSync((prev) => [
        {
          key: bc, barcode: bc, product_name: rowsOfBc[0]?.product_name || bc,
          variant_id: null, size_label: '', available: 0, quantity: 1,
          status: known ? 'choose' : 'pending',
          variants: known?.variants, multiVariant: true,
        },
        ...prev,
      ])
    } else if (okRows.length === 1) {
      // Aniq bitta ok qator (1 variantli) — +1 (cheklovda)
      const ok = okRows[0]
      if (ok.quantity >= ok.available) {
        notify('warning')
        setError(t('{{bc}}: omborda faqat {{available}} ta bor', { bc, available: ok.available }))
      } else {
        setRowsSync((prev) => prev.map((r) => (r.key === ok.key ? { ...r, quantity: r.quantity + 1 } : r)))
      }
    } else if (errored) {
      // Xato bo'lgan — qayta urinish
      needVerify = true
      setRowsSync((prev) =>
        prev.map((r) => (r.key === bc ? { ...r, status: 'pending', quantity: 1, error: undefined } : r)),
      )
    } else {
      // Butunlay yangi barkod — optimistik pending qator
      needVerify = true
      setRowsSync((prev) => [
        { key: bc, barcode: bc, product_name: bc, variant_id: null, size_label: '', available: 0, quantity: 1, status: 'pending' },
        ...prev,
      ])
    }

    if (needVerify) void verify(bc)
  }

  // Ko'p o'lchamli yukda o'lcham tanlash — choose qatorini o'sha o'lcham uchun
  // ok qatorga aylantiradi. Shu barkod+o'lcham allaqachon bo'lsa miqdor qo'shiladi.
  const pickVariant = (chooseKey: string, v: VariantAvailability) => {
    setRowsSync((prev) => {
      const ch = prev.find((r) => r.key === chooseKey)
      if (!ch) return prev
      const key = okKey(ch.barcode, v.variant_id)
      const existingOk = prev.find((r) => r.key === key && r.status === 'ok')
      const wanted = ch.quantity + (existingOk ? existingOk.quantity : 0)
      const finalQty = Math.min(wanted, v.available)
      const withoutChoose = prev.filter((r) => r.key !== chooseKey)
      if (existingOk) {
        return withoutChoose.map((r) => (r.key === key ? { ...r, quantity: finalQty, available: v.available } : r))
      }
      return [
        { ...ch, key, status: 'ok', variant_id: v.variant_id, size_label: v.size_label, available: v.available, quantity: finalQty, variants: undefined },
        ...withoutChoose,
      ]
    })
    notify('success')
  }

  const confirm = useMutation({
    mutationFn: () =>
      client.post(confirmUrl, {
        items: validRows.map((r) => ({
          barcode: r.barcode,
          variant_id: r.variant_id,
          quantity: r.quantity,
        })),
        ...confirmBody,
      }),
    onSuccess: () => { notify('success'); setDone(true) },
    onError: (err) => { setError(extractErrorMessage(err)); notify('error') },
  })

  const setQty = (key: string, qty: number) => {
    setRowsSync((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r
        const cap = r.status === 'ok' ? r.available : qty
        return { ...r, quantity: Math.max(1, Math.min(qty, cap)) }
      }),
    )
  }

  const removeRow = (key: string) => setRowsSync((prev) => prev.filter((r) => r.key !== key))

  if (done) {
    return <SuccessScreen title={successTitle}
      description={successDesc?.(totalQty) ?? t('{{totalQty}} ta mahsulot qayta ishlandi', { totalQty })} />
  }

  return (
    <div className="min-h-screen flex flex-col animate-fade-in">
      <Header title={title} subtitle={subtitle} showBack={showBack} onBack={onBack} />

      <ScanInput value={barcode} onChange={setBarcode} onScan={handleScan} loading={false} />

      {/* Fonда tekshirilayotgan skanlar (skan to'xtatmaydi — faqat ko'rsatkich) */}
      {checking > 0 && (
        <div className="mx-4 -mt-1 mb-2 flex items-center gap-2 text-xs text-slate-400">
          <span className="inline-block w-3 h-3 border-2 border-slate-200 border-t-red-400 rounded-full animate-spin" />
          {t('{{checking}} ta tekshirilmoqda…', { checking })}
        </div>
      )}

      {error && (
        <div className="mx-4 -mt-1 mb-2 bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-xl animate-fade-in">{error}</div>
      )}

      {/* Sanagich */}
      {rows.length > 0 && (
        <div className="px-4 pb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-700">{t('Jami')}</span>
          <span className="text-sm font-bold px-2.5 py-0.5 rounded-full text-white" style={{ background: 'var(--brand-gradient)' }}>
            {t('{{totalQty}} ta', { totalQty })}
          </span>
        </div>
      )}

      {/* Ro'yxat — har qatorда holat + miqdor boshqaruvi */}
      <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-32">
        {rows.map((r) => {
          const border =
            r.status === 'error' ? 'border-red-200 bg-red-50/40'
            : r.status === 'choose' ? 'border-amber-200 bg-amber-50/40'
            : r.status === 'pending' ? 'border-slate-200'
            : 'border-emerald-200 bg-white'
          return (
            <div key={r.key} className={`rounded-2xl p-3.5 border flex items-center gap-3 animate-scale-in ${border}`}>
              {/* Holat ikonkasi */}
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold">
                {r.status === 'ok' && <span className="bg-emerald-100 text-emerald-600 w-full h-full rounded-full flex items-center justify-center"><IconCheck size={18} /></span>}
                {r.status === 'pending' && <span className="w-4 h-4 border-2 border-slate-300 border-t-red-400 rounded-full animate-spin" />}
                {r.status === 'error' && <span className="bg-red-100 text-red-500 w-full h-full rounded-full flex items-center justify-center">✕</span>}
                {r.status === 'choose' && <span className="bg-amber-100 text-amber-600 w-full h-full rounded-full flex items-center justify-center">?</span>}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-slate-900 truncate">
                  {r.product_name}{r.size_label ? ` · ${r.size_label}` : ''}
                </p>
                <p className="text-xs font-mono text-slate-400">
                  {r.barcode}
                  {r.status === 'ok' && ` · max ${r.available}`}
                  {r.status === 'error' && <span className="text-red-500"> · {r.error}</span>}
                </p>

                {/* Ko'p o'lcham tanlash — qator ichida */}
                {r.status === 'choose' && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(r.variants ?? []).map((v) => (
                      <button key={v.variant_id} onClick={() => pickVariant(r.key, v)}
                        className="press px-2.5 py-1 rounded-lg border border-amber-300 text-xs font-semibold text-amber-700 bg-white">
                        {v.size_label || t('O\'lcham')} · {v.available}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Miqdor — faqat ok holatда */}
              {r.status === 'ok' ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => setQty(r.key, r.quantity - 1)}
                    className="press w-7 h-7 rounded-lg bg-slate-100 text-slate-600 font-bold flex items-center justify-center">−</button>
                  <input type="number" value={r.quantity}
                    onChange={(e) => setQty(r.key, parseInt(e.target.value) || 1)}
                    className="w-12 text-center font-bold text-slate-900 border border-slate-200 rounded-lg py-1 text-sm" />
                  <button onClick={() => setQty(r.key, r.quantity + 1)}
                    className="press w-7 h-7 rounded-lg bg-slate-100 text-slate-600 font-bold flex items-center justify-center">+</button>
                  <button onClick={() => removeRow(r.key)}
                    className="press w-7 h-7 rounded-lg text-red-400 flex items-center justify-center">🗑️</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold text-slate-400">{r.quantity}</span>
                  <button onClick={() => removeRow(r.key)}
                    className="press w-7 h-7 rounded-lg text-red-400 flex items-center justify-center">🗑️</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Tasdiqlash */}
      {validRows.length > 0 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100">
          {hasChoose && (
            <p className="text-xs text-amber-600 text-center mb-2">{t('⚠️ O\'lcham tanlanmagan yuklar tasdiqlanmaydi')}</p>
          )}
          {hasPending && (
            <p className="text-xs text-slate-500 text-center mb-2">{t('Ba\'zi yuklar hali tekshirilmoqda…')}</p>
          )}
          {hasErrors && (
            <p className="text-xs text-red-500 text-center mb-2">{t('Xatoli qatorlar tasdiqlashga kirmaydi')}</p>
          )}
          <button onClick={() => confirm.mutate()} disabled={confirm.isPending}
            style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
            className="press w-full text-white rounded-2xl py-4 font-bold shadow-[0_8px_24px_rgba(34,197,94,0.35)] disabled:opacity-50">
            {confirm.isPending ? t('Yuklanmoqda...') : t('Tasdiqlash ({{totalQty}} ta)', { totalQty })}
          </button>
        </div>
      )}
    </div>
  )
}
