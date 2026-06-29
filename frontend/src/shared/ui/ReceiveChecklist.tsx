import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { Header } from './Header'
import { ScanInput } from './ScanInput'
import { ListSkeleton, EmptyState, SuccessScreen } from './States'
import { IconBox, IconChevronRight, IconCheck } from './icons'

interface GroupItem {
  product_id: number
  variant_id: number
  barcode: string
  product_name: string
  size_label: string
  quantity: number
}

interface Group {
  holder_id: number
  holder_name: string
  holder_number: number | null
  items: GroupItem[]
  total: number
}

const itemKey = (it: { barcode: string; variant_id: number }) => `${it.barcode}:${it.variant_id}`

interface Props {
  title: string
  groupsUrl: string
  confirmUrl: string
  queryKey: string
  groupNoun: string          // masalan "Yo'lovchi" / "Kuryer"
  buttonLabel: string        // masalan "Qabul qildim"
  successTitle: string
  successDesc?: (n: number) => string
  invalidateKeys?: string[]  // muvaffaqiyatда yangilanadigan boshqa querylar
  onBack?: () => void
}

// Egadan (yo'lovchi/kuryer) yukni SKANLAB qabul qilish — har yuk to'liq
// skanlanmaguncha tasdiq tugmasi chiqmaydi. warehouse_uz topshirish kabi.
export function ReceiveChecklist({
  title, groupsUrl, confirmUrl, queryKey, groupNoun, buttonLabel,
  successTitle, successDesc, invalidateKeys = [], onBack,
}: Props) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [group, setGroup] = useState<Group | null>(null)
  const [done, setDone] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: () => client.get<Group[]>(groupsUrl).then((r) => r.data),
    enabled: !group && !done,
  })

  if (done) {
    return <SuccessScreen title={successTitle} description={successDesc?.(0) ?? t('Bajarildi')} />
  }

  if (group) {
    return (
      <GroupScan
        group={group}
        title={title}
        confirmUrl={confirmUrl}
        buttonLabel={buttonLabel}
        successTitle={successTitle}
        successDesc={successDesc}
        groupNoun={groupNoun}
        onBack={() => setGroup(null)}
        onDone={() => {
          setGroup(null)
          setDone(true)
          qc.invalidateQueries({ queryKey: [queryKey] })
          invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
        }}
      />
    )
  }

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title={title} subtitle={t('{{noun}}ni tanlang', { noun: groupNoun })} showBack onBack={onBack} />
      {isLoading ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState icon={<IconBox size={30} />} title={t('Qabul qilinadigan yuk yo\'q')} description={t('Hozircha yo\'lda yuk yo\'q')} />
      ) : (
        <div className="px-4 pt-4 space-y-2 web-grid">
          {data.map((g) => (
            <button key={g.holder_id} onClick={() => setGroup(g)}
              className="press w-full text-left rounded-2xl p-4 border flex items-center gap-3"
              style={{ background: 'var(--card-gradient)', borderColor: 'var(--line2)', boxShadow: 'var(--shadow-md)' }}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(106,163,255,0.14)', color: '#6aa3ff' }}>
                <IconBox size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14.5px] font-bold truncate" style={{ color: 'var(--ink)' }}>
                  {groupNoun} {g.holder_number ? `#${g.holder_number}` : ''}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {g.holder_name} · {t('{{n}} ta yuk', { n: g.total })}
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

function GroupScan({
  group, title, confirmUrl, buttonLabel, successTitle, successDesc, groupNoun, onBack, onDone,
}: {
  group: Group
  title: string
  confirmUrl: string
  buttonLabel: string
  successTitle: string
  successDesc?: (n: number) => string
  groupNoun: string
  onBack: () => void
  onDone: () => void
}) {
  const { t } = useTranslation()
  const { notify } = useTelegram()
  const [barcode, setBarcode] = useState('')
  const [error, setError] = useState('')
  const [scanned, setScanned] = useState<Record<string, number>>({})
  const [chooseBarcode, setChooseBarcode] = useState<string | null>(null)

  const allScanned = group.items.length > 0 && group.items.every((it) => (scanned[itemKey(it)] ?? 0) >= it.quantity)
  const totalScanned = group.items.reduce((s, it) => s + Math.min(scanned[itemKey(it)] ?? 0, it.quantity), 0)
  const total = useMemo(() => group.items.reduce((s, it) => s + it.quantity, 0), [group.items])

  const addOne = (it: GroupItem) => {
    const k = itemKey(it)
    const cur = scanned[k] ?? 0
    if (cur >= it.quantity) {
      notify('warning'); setError(t('{{name}}: to\'liq skanlandi', { name: it.product_name })); return
    }
    setScanned((p) => ({ ...p, [k]: cur + 1 })); setError(''); notify('success')
  }

  const handleScan = (raw: string) => {
    const bc = raw.trim()
    if (!bc) return
    setError('')
    const matches = group.items.filter((it) => it.barcode === bc && (scanned[itemKey(it)] ?? 0) < it.quantity)
    if (matches.length === 0) {
      const inGroup = group.items.some((it) => it.barcode === bc)
      notify('error')
      setError(inGroup ? t('{{bc}}: to\'liq skanlandi', { bc }) : t('{{bc}}: bu ro\'yxatda yo\'q', { bc }))
      return
    }
    if (matches.length === 1) addOne(matches[0])
    else setChooseBarcode(bc)
  }

  const confirm = useMutation({
    mutationFn: () =>
      client.post(confirmUrl, {
        // carrier_number — courier_tr qabul oqimi uchun (warehouse_tr e'tiborsiz qoldiradi)
        carrier_number: group.holder_number,
        items: group.items.map((it) => ({ barcode: it.barcode, variant_id: it.variant_id, quantity: it.quantity })),
      }),
    onSuccess: () => { notify('success'); onDone() },
    onError: (err) => { setError(extractErrorMessage(err)); notify('error') },
  })

  const chooseItems = chooseBarcode
    ? group.items.filter((it) => it.barcode === chooseBarcode && (scanned[itemKey(it)] ?? 0) < it.quantity)
    : []

  return (
    <div className="min-h-screen flex flex-col animate-fade-in">
      <Header
        title={title}
        subtitle={`${groupNoun} ${group.holder_number ? `#${group.holder_number}` : ''} · ${group.holder_name}`.trim()}
        showBack onBack={onBack}
      />
      <ScanInput value={barcode} onChange={setBarcode} onScan={handleScan} placeholder={t('Yuk barkodini skanlang')} />

      {error && <div className="mx-4 -mt-1 mb-2 bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-xl animate-fade-in">{error}</div>}

      <div className="px-4 pb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-slate-700">{t('Skanlandi')}</span>
        <span className="text-sm font-bold px-2.5 py-0.5 rounded-full text-white" style={{ background: 'var(--brand-gradient)' }}>
          {totalScanned} / {total}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-36">
        {group.items.map((it) => {
          const got = Math.min(scanned[itemKey(it)] ?? 0, it.quantity)
          const complete = got >= it.quantity
          return (
            <div key={itemKey(it)} className={`rounded-2xl p-3.5 border flex items-center gap-3 ${complete ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0">
                {complete
                  ? <span className="bg-emerald-100 text-emerald-600 w-full h-full rounded-full flex items-center justify-center"><IconCheck size={18} /></span>
                  : <span className="bg-slate-100 text-slate-400 w-full h-full rounded-full flex items-center justify-center"><IconBox size={18} /></span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-slate-900 truncate">{it.product_name}{it.size_label ? ` · ${it.size_label}` : ''}</p>
                <p className="text-xs font-mono text-slate-400">{it.barcode}</p>
              </div>
              <span className={`text-sm font-bold shrink-0 ${complete ? 'text-emerald-600' : 'text-slate-500'}`}>{got} / {it.quantity}</span>
            </div>
          )
        })}
      </div>

      {allScanned && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100">
          <button onClick={() => confirm.mutate()} disabled={confirm.isPending}
            style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
            className="press w-full text-white rounded-2xl py-4 font-bold shadow-[0_8px_24px_rgba(34,197,94,0.35)] disabled:opacity-50">
            {confirm.isPending ? t('Yuklanmoqda...') : `${buttonLabel} (${totalScanned} ta)`}
          </button>
        </div>
      )}

      {chooseBarcode && chooseItems.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setChooseBarcode(null)}>
          <div className="w-full max-w-[480px] bg-white rounded-t-3xl sm:rounded-3xl p-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold text-slate-900 mb-1">{t('Qaysi o\'lcham?')}</p>
            <p className="text-xs text-slate-500 mb-3 font-mono">{chooseBarcode}</p>
            <div className="flex flex-wrap gap-2">
              {chooseItems.map((it) => (
                <button key={itemKey(it)} onClick={() => { addOne(it); setChooseBarcode(null) }}
                  className="press px-3 py-2 rounded-xl border border-amber-300 text-sm font-semibold text-amber-700 bg-white">
                  {it.size_label || t('O\'lcham')} · {scanned[itemKey(it)] ?? 0}/{it.quantity}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
