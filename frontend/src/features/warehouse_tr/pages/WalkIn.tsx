import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { Header, Button, Input, Textarea, SuccessScreen, IconUser } from '@/shared/ui'

export default function WalkIn() {
  const { t } = useTranslation()
  const { notify } = useTelegram()
  const [form, setForm] = useState({ name: '', phone: '', note: '' })
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const mutation = useMutation({
    mutationFn: () => client.post('/warehouse-tr/walk-in', form),
    onSuccess: () => { notify('success'); setDone(true) },
    onError: (err) => { setError(extractErrorMessage(err)); notify('error') },
  })

  if (done) {
    return <SuccessScreen title={t('Saqlandi!')}
      action={<Button fullWidth variant="secondary"
        onClick={() => { setDone(false); setForm({ name: '', phone: '', note: '' }) }}>
        {t('Yangi mijoz')}
      </Button>} />
  }

  return (
    <div className="min-h-screen pb-32 animate-fade-in">
      <Header title={t('Telegramsiz mijoz')} subtitle={t("Qo'lda ro'yxatga olish")} showBack />
      <div className="px-4 pt-5 space-y-4">
        <div className="flex justify-center py-2">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-white" style={{ background: 'var(--brand-gradient)' }}>
            <IconUser size={30} />
          </div>
        </div>
        <Input label={t('Ism familiya')} placeholder={t('Mijoz ismi')}
          value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input type="tel" label={t('Telefon raqam')} placeholder="+90..."
          value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Textarea label={t('Izoh')} placeholder={t("Qo'shimcha ma'lumot")} rows={3}
          value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        {error && <div className="text-sm px-4 py-3 rounded-2xl" style={{ background: 'rgba(239,68,68,0.10)', color: 'var(--red)' }}>{error}</div>}
      </div>
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 backdrop-blur-xl border-t" style={{ background: 'rgba(255,255,255,0.85)', borderColor: 'var(--line)' }}>
        <Button fullWidth loading={mutation.isPending} disabled={!form.name || !form.phone}
          onClick={() => { setError(''); mutation.mutate() }}>{t('Saqlash')}</Button>
      </div>
    </div>
  )
}
