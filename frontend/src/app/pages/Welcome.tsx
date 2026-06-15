import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { useAuthStore } from '@/shared/store/auth'
import type { Role, User } from '@/shared/types'
import { IconBag, IconPlane } from '@/shared/ui'

export default function Welcome() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { haptic, notify } = useTelegram()
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const setAuth = useAuthStore((s) => s.setAuth)
  const [loading, setLoading] = useState<Role | null>(null)
  const [error, setError] = useState('')

  // Token yo'q bo'lsa (o'chirilgan/qaytib kelgan user) — Telegram initData bilan login qilamiz
  const ensureLogin = async (): Promise<boolean> => {
    if (token) return true
    const initData = window.Telegram?.WebApp?.initData ?? ''
    if (!initData) return false
    try {
      const res = await client.post<{ token: string; user: User }>('/auth/login', {
        tg_init_data: initData,
      })
      setAuth(res.data.token, res.data.user)
      return true
    } catch {
      return false
    }
  }

  const selectRole = async (role: Role, home: string) => {
    if (loading) return
    haptic('medium')
    setError('')
    if (token && user?.role === role) { navigate(home); return }
    setLoading(role)
    try {
      // Avval login bo'lganligiga ishonch hosil qilamiz (token yo'q bo'lsa)
      const ok = await ensureLogin()
      if (!ok) {
        setError(t("Iltimos, botga qaytib /start ni bosing va ilovani qayta oching"))
        notify('error')
        return
      }
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

  return (
    <div className="min-h-screen flex flex-col px-6 animate-fade-in">
      <div className="pt-16 pb-10 text-center">
        <div className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-5 shadow-[var(--shadow-brand)]"
          style={{ background: 'var(--brand-gradient)' }}>
          <IconPlane size={38} className="text-white" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Ali Bridge</h1>
        <p className="text-sm text-slate-500 mt-1.5">{t('Toshkent → Turkiya kargo tizimi')}</p>
      </div>

      <div className="flex flex-col gap-3.5 flex-1">
        {/* Turkiyaga yuk olib ketish — tepada */}
        <button onClick={() => selectRole('carrier', '/carrier')} disabled={loading !== null}
          className="press bg-white rounded-3xl p-5 border border-slate-100 shadow-[var(--shadow-md)] flex items-center gap-4 text-left disabled:opacity-60">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0"
            style={{ background: 'var(--brand-gradient)' }}>
            <IconPlane size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 text-[16px]">{t('Turkiyaga yuk olib ketish')}</h3>
            <p className="text-[13px] text-slate-500 mt-0.5">{t("Yo'lovchi sifatida pul ishlang")}</p>
          </div>
          {loading === 'carrier'
            ? <span className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin shrink-0" />
            : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-slate-300 shrink-0"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </button>

        {/* Buyurtma berish — pastda */}
        <button onClick={() => selectRole('orderer', '/orderer')} disabled={loading !== null}
          className="press bg-white rounded-3xl p-5 border border-slate-100 shadow-[var(--shadow-md)] flex items-center gap-4 text-left disabled:opacity-60">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)' }}>
            <IconBag size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 text-[16px]">{t('Buyurtma berish')}</h3>
            <p className="text-[13px] text-slate-500 mt-0.5">{t('Mahsulot buyurtma qiling')}</p>
          </div>
          {loading === 'orderer'
            ? <span className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin shrink-0" />
            : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-slate-300 shrink-0"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl mb-3">{error}</div>}
      <p className="text-center text-xs text-slate-400 pb-6">Ali Bridge © 2026</p>
    </div>
  )
}
