import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { useMutation } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import { Header, Button, Input, Textarea, ScanSession, SuccessScreen, IconBox, IconAlert } from '@/shared/ui'

type View = 'menu' | 'receive' | 'damaged'

export default function ReceiveFromUZ() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { notify, haptic } = useTelegram()
  const [view, setView] = useState<View>('menu')

  // Shikast holati
  const [damaged, setDamaged] = useState({ carrier_number: '', barcode: '', note: '' })
  const [damagedError, setDamagedError] = useState('')
  const [damagedDone, setDamagedDone] = useState(false)

  const damagedMutation = useMutation({
    mutationFn: () => client.post('/courier-tr/report-damaged', {
      carrier_number: parseInt(damaged.carrier_number),
      barcode: damaged.barcode, note: damaged.note,
    }),
    onSuccess: () => { notify('success'); setDamagedDone(true) },
    onError: (err) => { setDamagedError(extractErrorMessage(err)); notify('error') },
  })

  // === Qabul qilish (ScanSession) ===
  if (view === 'receive') {
    return (
      <ScanSession
        title={t('Yuklarni qabul qilish')}
        subtitle={t('Barkodlarni skanlang')}
        showBack
        onBack={() => setView('menu')}
        scanUrl="/courier-tr/scan-receive"
        confirmUrl="/courier-tr/confirm-receive"
        successTitle={t('Qabul qilindi!')}
        successDesc={(n) => t('{{n}} ta mahsulot omborga olib boriladi.', { n })}
      />
    )
  }

  // === Shikast ===
  if (view === 'damaged') {
    if (damagedDone) {
      return <SuccessScreen title={t('Kiritildi!')} description={t('Admin va Turkiya ombori xabardor qilindi.')}
        action={<Button fullWidth variant="secondary"
          onClick={() => { setDamagedDone(false); setDamaged({ carrier_number: '', barcode: '', note: '' }) }}>
          {t('Yana kiritish')}
        </Button>} />
    }
    return (
      <div className="min-h-screen pb-32 animate-fade-in">
        <Header title={t('Shikastlangan yuklar')} showBack onBack={() => setView('menu')} />
        <div className="px-4 pt-5 space-y-4">
          <div className="rounded-2xl p-4 flex gap-3 bg-red-50">
            <div className="text-red-500 shrink-0"><IconAlert size={20} /></div>
            <p className="text-[13px] text-red-900/70 leading-snug">
              {t('Yo\'lovchi raqamini kiriting, so\'ng shikastlangan mahsulot barkodini skanlang.')}
            </p>
          </div>
          <Input type="number" label={t('Yo\'lovchi raqami')} placeholder={t('Masalan: 47')}
            value={damaged.carrier_number} onChange={(e) => setDamaged({ ...damaged, carrier_number: e.target.value })} />
          <Input label={t('Shikastlangan mahsulot barkodi')} placeholder={t('Barkod')} className="font-mono"
            value={damaged.barcode} onChange={(e) => setDamaged({ ...damaged, barcode: e.target.value })} />
          <Textarea label={t('Izoh (ixtiyoriy)')} placeholder={t('Nima bo\'lgani haqida')} rows={3}
            value={damaged.note} onChange={(e) => setDamaged({ ...damaged, note: e.target.value })} />
          {damagedError && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl">{damagedError}</div>}
        </div>
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100">
          <Button variant="danger" fullWidth loading={damagedMutation.isPending}
            disabled={!damaged.carrier_number.trim() || isNaN(parseInt(damaged.carrier_number, 10)) || !damaged.barcode.trim()}
            onClick={() => { setDamagedError(''); damagedMutation.mutate() }}>
            {t('Shikastlangan deb belgilash')}
          </Button>
        </div>
      </div>
    )
  }

  // === Menu ===
  return (
    <div className="min-h-screen animate-fade-in">
      <Header title={t('O\'zbekistondan yuklar')} showBack onBack={() => navigate('/courier-tr')} />
      <div className="px-4 pt-6 space-y-3.5">
        <button onClick={() => { haptic('light'); setView('receive') }}
          className="press w-full bg-white rounded-3xl p-5 border border-slate-100 shadow-[var(--shadow-md)] text-left flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
            <IconBox size={26} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-900">{t('Yuklarni qabul qilish')}</h3>
            <p className="text-sm text-slate-400">{t('Yo\'lovchidan olish')}</p>
          </div>
        </button>

        <button onClick={() => { haptic('light'); setView('damaged') }}
          className="press w-full bg-white rounded-3xl p-5 border border-red-100 shadow-[var(--shadow-md)] text-left flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
            <IconAlert size={26} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-900">{t('Shikastlangan yuklar')}</h3>
            <p className="text-sm text-slate-400">{t('Zararni qayd etish')}</p>
          </div>
        </button>
      </div>
    </div>
  )
}
