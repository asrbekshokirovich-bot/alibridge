import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { Header, Button, Input, Textarea, SuccessScreen, IconUser } from '@/shared/ui'

export default function WalkIn() {
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
    return <SuccessScreen title="Saqlandi!"
      action={<Button fullWidth variant="secondary"
        onClick={() => { setDone(false); setForm({ name: '', phone: '', note: '' }) }}>
        Yangi mijoz
      </Button>} />
  }

  return (
    <div className="min-h-screen pb-32 animate-fade-in">
      <Header title="Telegramsiz mijoz" subtitle="Qo'lda ro'yxatga olish" showBack />
      <div className="px-4 pt-5 space-y-4">
        <div className="flex justify-center py-2">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
            <IconUser size={30} />
          </div>
        </div>
        <Input label="Ism familiya" placeholder="Mijoz ismi"
          value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input type="tel" label="Telefon raqam" placeholder="+90..."
          value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Textarea label="Izoh" placeholder="Qo'shimcha ma'lumot" rows={3}
          value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl">{error}</div>}
      </div>
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100">
        <Button fullWidth loading={mutation.isPending} disabled={!form.name || !form.phone}
          onClick={() => { setError(''); mutation.mutate() }}>Saqlash</Button>
      </div>
    </div>
  )
}
