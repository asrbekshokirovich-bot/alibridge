import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { Header, Button, ListSkeleton, EmptyState, SuccessScreen, IconHandshake, IconCheck, IconUser } from '@/shared/ui'

interface Courier { id: number; first_name: string; last_name: string }

export default function AutoReceive() {
  const { notify, haptic } = useTelegram()
  const [selected, setSelected] = useState<number | null>(null)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const { data: couriers, isLoading } = useQuery({
    queryKey: ['couriers-uz-active'],
    queryFn: () => client.get<Courier[]>('/couriers/uz/active').then((r) => r.data),
  })

  const handleConfirm = async () => {
    if (!selected) return
    setError('')
    try {
      await client.post('/carrier/auto-receive', { courier_id: selected })
      notify('success'); setSuccess(true)
    } catch (err) { setError(extractErrorMessage(err)); notify('error') }
  }

  if (success) {
    return <SuccessScreen title="Tayyor!"
      description="Kuryer yukni siz uchun skanlaydi va yuklar avtomatik sizga o'tadi." />
  }

  return (
    <div className="min-h-screen pb-28 animate-fade-in">
      <Header title="Kuryerdan qabul" subtitle="Sizga yuk beradigan kuryerni tanlang" />

      {/* Info banner */}
      <div className="px-4 pt-4">
        <div className="rounded-2xl p-4 flex gap-3" style={{ background: 'var(--brand-gradient-soft)' }}>
          <div className="text-red-500 shrink-0"><IconHandshake size={22} /></div>
          <p className="text-[13px] text-red-900/80 leading-snug">
            Aeroportда kuryer yoningizda. Uni tanlang, u barkodlarni skanlasin — yuklar sizga o'tadi.
          </p>
        </div>
      </div>

      {isLoading ? (
        <ListSkeleton count={3} />
      ) : !couriers?.length ? (
        <EmptyState icon={<IconUser size={30} />} title="Kuryer yo'q" description="Hozircha faol kuryer mavjud emas" />
      ) : (
        <div className="px-4 pt-4 space-y-2.5">
          {couriers.map((c) => {
            const active = selected === c.id
            return (
              <button key={c.id}
                onClick={() => { haptic('light'); setSelected(c.id) }}
                className={`press w-full bg-white rounded-2xl p-3.5 border-2 flex items-center gap-3 text-left transition-colors ${active ? 'border-red-400' : 'border-slate-100'}`}>
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0"
                  style={{ background: active ? 'var(--brand-gradient)' : 'linear-gradient(135deg, #94a3b8, #64748b)' }}>
                  <IconUser size={20} />
                </div>
                <span className="flex-1 font-semibold text-slate-900">{c.first_name} {c.last_name}</span>
                {active && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white" style={{ background: 'var(--brand-gradient)' }}>
                    <IconCheck size={14} />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {error && <p className="text-red-500 text-sm px-4 mt-3">{error}</p>}

      {selected && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-[480px] px-4 z-20 animate-slide-up">
          <Button fullWidth onClick={handleConfirm}>Tasdiqlash</Button>
        </div>
      )}
    </div>
  )
}
