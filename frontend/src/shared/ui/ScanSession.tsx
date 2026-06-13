import { useState, useRef, useCallback } from 'react'
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

// Skanlangan qator — barcode bo'yicha kalitlangan (optimistik: darhol qo'shiladi,
// mahsulot ma'lumoti fonда to'ldiriladi).
interface ScannedRow {
  barcode: string
  product_name: string
  variant_id: number | null   // server aniqlagach to'ladi (1 variantli yoki tanlangach)
  size_label: string
  available: number           // manbada bori (server javobidan); 0 = noma'lum
  quantity: number
  status: RowStatus
  error?: string              // xato matni (status=error)
  variants?: VariantAvailability[] // status=choose bo'lsa tanlash uchun
}

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
      setRowsSync((prev) =>
        prev.map((r) => {
          if (r.barcode !== bc || r.status !== 'pending') return r
          if (variants.length === 0) {
            return { ...r, status: 'error', error: 'qolmagan', product_name: data.product_name || bc }
          }
          if (variants.length === 1) {
            const v = variants[0]
            // Optimistik qo'shilgan miqdor available'dan oshmasin
            return {
              ...r,
              status: 'ok',
              product_name: data.product_name,
              variant_id: v.variant_id,
              size_label: v.size_label,
              available: v.available,
              quantity: Math.min(r.quantity, v.available),
            }
          }
          // Ko'p o'lcham — foydalanuvchi tanlaydi
          return { ...r, status: 'choose', product_name: data.product_name, variants }
        }),
      )
      if (variants.length === 0) notify('error')
      else notify('success')
    } catch (err) {
      const msg = extractErrorMessage(err)
      setRowsSync((prev) =>
        prev.map((r) =>
          r.barcode === bc && r.status === 'pending' ? { ...r, status: 'error', error: msg } : r,
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
    const existing = rowsRef.current.find((r) => r.barcode === bc)
    let needVerify = false

    if (!existing) {
      // Yangi barkod — optimistik pending qator (tepaga)
      needVerify = true
      setRowsSync((prev) => [
        { barcode: bc, product_name: bc, variant_id: null, size_label: '', available: 0, quantity: 1, status: 'pending' },
        ...prev,
      ])
    } else if (existing.status === 'error') {
      // Xato bo'lgan — qayta urinish
      needVerify = true
      setRowsSync((prev) =>
        prev.map((r) => (r.barcode === bc ? { ...r, status: 'pending', quantity: 1, error: undefined } : r)),
      )
    } else if (existing.status === 'choose') {
      // O'lcham tanlanishi kerak — +1 qo'shmaymiz
    } else {
      // ok yoki pending — miqdor +1 (ok bo'lsa available cheklovida)
      const cap = existing.status === 'ok' ? existing.available : Infinity
      if (existing.quantity >= cap) {
        notify('warning')
      } else {
        setRowsSync((prev) => prev.map((r) => (r.barcode === bc ? { ...r, quantity: r.quantity + 1 } : r)))
      }
    }

    if (needVerify) void verify(bc)
  }

  // Ko'p o'lchamli yukda o'lcham tanlash
  const pickVariant = (bc: string, v: VariantAvailability) => {
    setRowsSync((prev) =>
      prev.map((r) =>
        r.barcode === bc
          ? {
              ...r,
              status: 'ok',
              variant_id: v.variant_id,
              size_label: v.size_label,
              available: v.available,
              quantity: Math.min(r.quantity, v.available),
              variants: undefined,
            }
          : r,
      ),
    )
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

  const setQty = (bc: string, qty: number) => {
    setRowsSync((prev) =>
      prev.map((r) => {
        if (r.barcode !== bc) return r
        const cap = r.status === 'ok' ? r.available : qty
        return { ...r, quantity: Math.max(1, Math.min(qty, cap)) }
      }),
    )
  }

  const removeRow = (bc: string) => setRowsSync((prev) => prev.filter((r) => r.barcode !== bc))

  if (done) {
    return <SuccessScreen title={successTitle}
      description={successDesc?.(totalQty) ?? `${totalQty} ta mahsulot qayta ishlandi`} />
  }

  return (
    <div className="min-h-screen flex flex-col animate-fade-in">
      <Header title={title} subtitle={subtitle} showBack={showBack} onBack={onBack} />

      <ScanInput value={barcode} onChange={setBarcode} onScan={handleScan} loading={false} />

      {/* Fonда tekshirilayotgan skanlar (skan to'xtatmaydi — faqat ko'rsatkich) */}
      {checking > 0 && (
        <div className="mx-4 -mt-1 mb-2 flex items-center gap-2 text-xs text-slate-400">
          <span className="inline-block w-3 h-3 border-2 border-slate-200 border-t-red-400 rounded-full animate-spin" />
          {checking} ta tekshirilmoqda…
        </div>
      )}

      {error && (
        <div className="mx-4 -mt-1 mb-2 bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-xl animate-fade-in">{error}</div>
      )}

      {/* Sanagich */}
      {rows.length > 0 && (
        <div className="px-4 pb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-700">Jami</span>
          <span className="text-sm font-bold px-2.5 py-0.5 rounded-full text-white" style={{ background: 'var(--brand-gradient)' }}>
            {totalQty} ta
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
            <div key={r.barcode} className={`rounded-2xl p-3.5 border flex items-center gap-3 animate-scale-in ${border}`}>
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
                      <button key={v.variant_id} onClick={() => pickVariant(r.barcode, v)}
                        className="press px-2.5 py-1 rounded-lg border border-amber-300 text-xs font-semibold text-amber-700 bg-white">
                        {v.size_label || 'O\'lcham'} · {v.available}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Miqdor — faqat ok holatда */}
              {r.status === 'ok' ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => setQty(r.barcode, r.quantity - 1)}
                    className="press w-7 h-7 rounded-lg bg-slate-100 text-slate-600 font-bold flex items-center justify-center">−</button>
                  <input type="number" value={r.quantity}
                    onChange={(e) => setQty(r.barcode, parseInt(e.target.value) || 1)}
                    className="w-12 text-center font-bold text-slate-900 border border-slate-200 rounded-lg py-1 text-sm" />
                  <button onClick={() => setQty(r.barcode, r.quantity + 1)}
                    className="press w-7 h-7 rounded-lg bg-slate-100 text-slate-600 font-bold flex items-center justify-center">+</button>
                  <button onClick={() => removeRow(r.barcode)}
                    className="press w-7 h-7 rounded-lg text-red-400 flex items-center justify-center">🗑️</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold text-slate-400">{r.quantity}</span>
                  <button onClick={() => removeRow(r.barcode)}
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
          {hasErrors && (
            <p className="text-xs text-red-500 text-center mb-2">Xatoli qatorlar tasdiqlashga kirmaydi</p>
          )}
          <button onClick={() => confirm.mutate()} disabled={confirm.isPending}
            style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
            className="press w-full text-white rounded-2xl py-4 font-bold shadow-[0_8px_24px_rgba(34,197,94,0.35)] disabled:opacity-50">
            {confirm.isPending ? 'Yuklanmoqda...' : `Tasdiqlash (${totalQty} ta)`}
          </button>
        </div>
      )}
    </div>
  )
}
