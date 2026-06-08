import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client, { extractErrorMessage } from '@/shared/api/client'
import { ROLE_HOME } from '@/app/router'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { useAuthStore } from '@/shared/store/auth'
import type { Role, User } from '@/shared/types'
import { IconBag, IconPlane, IconUsers } from '@/shared/ui'

// Joriy rol uchun "Davom etish" tugmasida ko'rsatiladigan nom
const ROLE_LABEL: Record<string, string> = {
  orderer: 'Buyurtmachi paneli',
  carrier: 'Yo\'lovchi paneli',
  warehouse_uz: 'Toshkent ombori',
  warehouse_tr: 'Turkiya ombori',
  courier_uz: 'Toshkent kuryeri',
  courier_tr: 'Turkiya kuryeri',
  china_worker: 'Xitoy ishchisi',
  admin: 'Admin paneli',
}

export default function Welcome() {
  const navigate = useNavigate()
  const { haptic, notify } = useTelegram()
  const user = useAuthStore((s) => s.user)
  const setAuth = useAuthStore((s) => s.setAuth)
  const [loading, setLoading] = useState<Role | null>(null)
  const [error, setError] = useState('')

  // Allaqachon rol tanlagan bo'lsa — o'z paneliga tezkor kirish tugmasi ko'rsatiladi
  const currentHome = user ? ROLE_HOME[user.role] : undefined
  const currentLabel = user ? ROLE_LABEL[user.role] : undefined

  // Yo'lovchi/Buyurtmachi: rolni almashtirib darrov panelga kiramiz (ro'yxatdan o'tish yo'q)
  const selectRole = async (role: Role, home: string) => {
    if (loading) return
    haptic('medium')
    setError('')
    // Allaqachon o'sha rolda — to'g'ridan-to'g'ri
    if (user?.role === role) {
      navigate(home)
      return
    }
    setLoading(role)
    try {
      const res = await client.post<{ token: string; user: User }>('/auth/select-role', { role })
      setAuth(res.data.token, res.data.user)
      notify('success')
      navigate(home)
    } catch (err) {
      setError(extractErrorMessage(err))
      notify('error')
    } finally {
      setLoading(null)
    }
  }

  // Kompaniya xodimi: admin tasdig'i uchun so'rov yuboramiz
  const requestStaff = async () => {
    if (loading) return
    haptic('medium')
    setError('')
    setLoading('pending' as Role)
    try {
      const res = await client.post<{ token: string; user: User }>('/auth/staff-request')
      setAuth(res.data.token, res.data.user)
      notify('success')
      navigate('/staff/pending')
    } catch (err) {
      setError(extractErrorMessage(err))
      notify('error')
    } finally {
      setLoading(null)
    }
  }

  const options = [
    {
      title: 'Buyurtma berish',
      desc: 'Mahsulot buyurtma qiling',
      icon: <IconBag size={26} />,
      role: 'orderer' as Role,
      gradient: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
      onClick: () => selectRole('orderer', '/orderer'),
    },
    {
      title: 'Turkiyaga yuk olib ketish',
      desc: 'Yo\'lovchi sifatida pul ishlang',
      icon: <IconPlane size={26} />,
      role: 'carrier' as Role,
      gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      onClick: () => selectRole('carrier', '/carrier'),
    },
    {
      title: 'Kompaniya xodimi',
      desc: 'Jamoa a\'zosi sifatida kirish',
      icon: <IconUsers size={26} />,
      role: 'staff' as Role,
      gradient: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
      onClick: requestStaff,
    },
  ]

  return (
    <div className="min-h-screen flex flex-col px-6 animate-fade-in">
      {/* Logo / Hero */}
      <div className="pt-16 pb-10 text-center">
        <div
          className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-5 shadow-[var(--shadow-brand)]"
          style={{ background: 'var(--brand-gradient)' }}
        >
          <IconPlane size={38} className="text-white" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">ALI BRIDGE</h1>
        <p className="text-sm text-slate-500 mt-1.5">Toshkent → Turkiya kargo tizimi</p>
      </div>

      {/* Joriy rol — tezkor davom etish (rol tanlagan foydalanuvchilar uchun) */}
      {currentHome && currentLabel && (
        <button
          onClick={() => {
            haptic('medium')
            navigate(currentHome)
          }}
          className="press w-full mb-4 rounded-3xl p-4 flex items-center gap-4 text-left text-white shadow-[var(--shadow-brand)]"
          style={{ background: 'var(--brand-gradient)' }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white/20 shrink-0">
            <IconPlane size={26} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[15px]">Davom etish</h3>
            <p className="text-[13px] text-white/80">{currentLabel}</p>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white/70 shrink-0">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* Tanlovlar */}
      <div className="flex flex-col gap-3.5 flex-1">
        {options.map((opt) => (
          <button
            key={opt.title}
            onClick={opt.onClick}
            disabled={loading !== null}
            className="press bg-white rounded-3xl p-4 border border-slate-100 shadow-[var(--shadow-md)] flex items-center gap-4 text-left disabled:opacity-60"
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0"
              style={{ background: opt.gradient }}
            >
              {opt.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-900 text-[15px]">{opt.title}</h3>
              <p className="text-[13px] text-slate-500">{opt.desc}</p>
            </div>
            {loading === opt.role ? (
              <span className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin shrink-0" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-slate-300 shrink-0">
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl mb-3">{error}</div>
      )}

      <p className="text-center text-xs text-slate-400 py-6">ALI BRIDGE © 2026</p>
    </div>
  )
}
