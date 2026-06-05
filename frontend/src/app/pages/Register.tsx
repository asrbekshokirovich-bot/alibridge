import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useAuthStore } from '@/shared/store/auth'
import { useTelegram } from '@/shared/hooks/useTelegram'
import type { User } from '@/shared/types'
import { Button, Input, Header, IconUser, IconPlane, IconUsers, IconBag } from '@/shared/ui'

type RegType = 'orderer' | 'carrier' | 'staff'

const meta: Record<RegType, { title: string; icon: React.ReactNode; gradient: string }> = {
  orderer: { title: 'Buyurtmachi', icon: <IconBag size={28} />, gradient: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)' },
  carrier: { title: 'Yo\'lovchi', icon: <IconPlane size={28} />, gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' },
  staff: { title: 'Kompaniya xodimi', icon: <IconUsers size={28} />, gradient: 'linear-gradient(135deg, #64748b 0%, #475569 100%)' },
}

export default function Register() {
  const { type } = useParams<{ type: RegType }>()
  const regType: RegType = (type as RegType) ?? 'staff'
  const navigate = useNavigate()
  const { tgUser, initData, notify } = useTelegram()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [form, setForm] = useState({
    first_name: tgUser?.first_name ?? '',
    last_name: tgUser?.last_name ?? '',
    phone: '',
    passport: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await client.post<{ token: string; user: User }>('/auth/register', {
        ...form, reg_type: regType, tg_init_data: initData,
      })
      setAuth(res.data.token, res.data.user)
      notify('success')
      if (regType === 'staff') navigate('/staff/pending')
      else if (regType === 'carrier') navigate('/carrier')
      else navigate('/orderer')
    } catch (err) {
      setError(extractErrorMessage(err))
      notify('error')
    } finally {
      setLoading(false)
    }
  }

  const m = meta[regType]

  return (
    <div className="min-h-screen animate-fade-in">
      <Header title="Ro'yxatdan o'tish" showBack onBack={() => navigate('/welcome')} />

      <div className="px-5 pt-6">
        <div className="flex flex-col items-center mb-7">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-white mb-3 shadow-lg" style={{ background: m.gradient }}>
            {m.icon}
          </div>
          <h2 className="text-lg font-bold text-slate-900">{m.title}</h2>
          <p className="text-sm text-slate-500">Ma'lumotlaringizni kiriting</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-3">
            <Input placeholder="Ism" value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
            <Input placeholder="Familiya" value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
          </div>
          <Input type="tel" placeholder="+998 90 123 45 67" icon={<IconUser size={18} />}
            value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          <Input placeholder="Passport seriya raqami" value={form.passport}
            onChange={(e) => setForm({ ...form, passport: e.target.value })} required />

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl">{error}</div>
          )}

          <Button type="submit" fullWidth loading={loading} className="mt-2">
            Davom etish
          </Button>
        </form>
      </div>
    </div>
  )
}
