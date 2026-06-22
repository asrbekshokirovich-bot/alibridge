import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { useAuthStore } from '@/shared/store/auth'
import type { Role, User } from '@/shared/types'

export default function Welcome() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { haptic, notify } = useTelegram()
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const setAuth = useAuthStore((s) => s.setAuth)
  const [loading, setLoading] = useState<Role | null>(null)
  const [error, setError] = useState('')

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
    <div className="min-h-screen flex flex-col animate-fade-in" style={{ background: 'var(--bg)' }}>

      {/* Hero */}
      <div className="flex flex-col items-center pt-16 pb-10 px-6 text-center relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(255,71,87,0.18) 0%, transparent 70%)',
        }} />

        {/* Logo */}
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-3xl blur-2xl opacity-60 scale-110"
            style={{ background: 'var(--brand-gradient)' }} />
          <div className="relative w-24 h-24 rounded-3xl flex items-center justify-center shadow-[var(--shadow-brand)]"
            style={{ background: 'var(--brand-gradient)' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-white">
              <path d="M22 16.5H2M22 16.5L18.5 13M22 16.5L18.5 20" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 7.5H22M2 7.5L5.5 4M2 7.5L5.5 11" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        <h1 className="text-[34px] font-black tracking-tight leading-none mb-2">
          <span style={{ background: 'var(--brand-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            ALI
          </span>
          {' '}
          <span style={{ color: 'var(--text)' }}>BRIDGE</span>
        </h1>
        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          🇺🇿 Toshkent → 🇹🇷 Turkiya · Kargo logistikasi
        </p>
      </div>

      {/* Role cards */}
      <div className="flex-1 flex flex-col gap-3 px-5 pb-4">
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
          {t("Rolni tanlang")}
        </p>

        {/* Carrier */}
        <button
          onClick={() => selectRole('carrier', '/carrier')}
          disabled={loading !== null}
          className="press relative overflow-hidden rounded-3xl p-5 flex items-center gap-4 text-left disabled:opacity-60 border"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity pointer-events-none"
            style={{ background: 'var(--brand-gradient-soft)' }} />
          <div className="relative w-[56px] h-[56px] rounded-2xl flex items-center justify-center text-white shrink-0 shadow-[var(--shadow-brand)]"
            style={{ background: 'var(--brand-gradient)' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M22 16.5H2M22 16.5L18.5 13M22 16.5L18.5 20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5 7.5h14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0 relative">
            <h3 className="font-bold text-[16px]" style={{ color: 'var(--text)' }}>
              {t('Turkiyaga yuk olib ketish')}
            </h3>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {t("Yo'lovchi sifatida pul ishlang")}
            </p>
          </div>
          <div className="relative shrink-0">
            {loading === 'carrier'
              ? <span className="w-5 h-5 border-2 rounded-full animate-spin block"
                  style={{ borderColor: 'var(--border)', borderTopColor: 'var(--brand)' }} />
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--border)' }}>
                  <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            }
          </div>
        </button>

        {/* Orderer */}
        <button
          onClick={() => selectRole('orderer', '/orderer')}
          disabled={loading !== null}
          className="press relative overflow-hidden rounded-3xl p-5 flex items-center gap-4 text-left disabled:opacity-60 border"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div className="relative w-[56px] h-[56px] rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.2) 0%, rgba(167,139,250,0.1) 100%)', border: '1px solid rgba(167,139,250,0.3)' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 6h18M16 10a4 4 0 01-8 0" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[16px]" style={{ color: 'var(--text)' }}>
              {t('Buyurtma berish')}
            </h3>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {t('Mahsulot buyurtma qiling')}
            </p>
          </div>
          <div className="shrink-0">
            {loading === 'orderer'
              ? <span className="w-5 h-5 border-2 rounded-full animate-spin block"
                  style={{ borderColor: 'var(--border)', borderTopColor: '#a78bfa' }} />
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--border)' }}>
                  <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            }
          </div>
        </button>

        {/* Staff login link */}
        <button
          onClick={() => navigate('/web-login')}
          className="press mt-1 py-3 rounded-2xl text-sm font-medium transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          {t('Xodim sifatida kirish')} →
        </button>
      </div>

      {error && (
        <div className="mx-5 mb-3 px-4 py-3 rounded-2xl text-sm" style={{ background: 'rgba(255,71,87,0.15)', color: '#ff6b7a', border: '1px solid rgba(255,71,87,0.25)' }}>
          {error}
        </div>
      )}

      <p className="text-center text-xs pb-8" style={{ color: 'var(--text-muted)' }}>
        Ali Bridge © 2026
      </p>
    </div>
  )
}
