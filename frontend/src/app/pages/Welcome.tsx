import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { useAuthStore } from '@/shared/store/auth'
import type { Role, User } from '@/shared/types'
import { IconTruck, IconBag, IconChevronRight } from '@/shared/ui'

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
      <div className="px-5 pt-6">
        <div
          className="relative overflow-hidden rounded-[22px] px-7 py-8 text-center"
          style={{
            background: 'linear-gradient(135deg,#1A3A6C 0%,#132A4D 58%,#0F213D 100%)',
            boxShadow: '0 18px 44px rgba(10,26,52,0.30)',
          }}
        >
          {/* Decorative shapes */}
          <span
            className="absolute pointer-events-none"
            style={{
              top: -44, right: -30, width: 160, height: 160,
              background: 'var(--lime)', opacity: 0.15,
              transform: 'rotate(42deg)', borderRadius: 30,
            }}
          />
          <span
            className="absolute pointer-events-none"
            style={{ bottom: -60, right: 90, width: 120, height: 120, border: '1px solid rgba(255,255,255,0.10)', borderRadius: '50%' }}
          />

          {/* Logo tile */}
          <div className="relative flex justify-center mb-5">
            <div
              className="w-[60px] h-[60px] rounded-[18px] flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.13)', border: '1px solid rgba(255,255,255,0.18)' }}
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <path d="M22 16.5H2M22 16.5L18.5 13M22 16.5L18.5 20" stroke="#D4E94C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 7.5H22M2 7.5L5.5 4M2 7.5L5.5 11" stroke="#D4E94C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div
            className="relative text-[11px] font-bold uppercase mb-2"
            style={{ letterSpacing: '0.14em', color: 'var(--lime)' }}
          >
            Kargo logistikasi
          </div>
          <h1 className="relative text-[32px] font-extrabold tracking-[-0.02em] leading-none text-white">
            ALI BRIDGE
          </h1>
          <p className="relative text-[13.5px] font-medium mt-2.5" style={{ color: 'rgba(214,222,236,0.86)' }}>
            Toshkent (TAS) → Istanbul (IST) · Kargo logistikasi
          </p>
        </div>
      </div>

      {/* Role cards */}
      <div className="flex-1 flex flex-col gap-3 px-5 pt-6 pb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] mb-1" style={{ color: 'var(--muted2)' }}>
          {t("Rolni tanlang")}
        </p>

        {/* Carrier */}
        <button
          onClick={() => selectRole('carrier', '/carrier')}
          disabled={loading !== null}
          className="press rounded-2xl p-5 flex items-center gap-4 text-left disabled:opacity-60 border"
          style={{ background: 'var(--surface)', borderColor: 'var(--line)', boxShadow: 'var(--shadow-md)' }}
        >
          <div
            className="w-[56px] h-[56px] rounded-[16px] flex items-center justify-center text-white shrink-0"
            style={{ background: 'linear-gradient(135deg,#1A3A6C,#132A4D)', boxShadow: '0 8px 20px rgba(26,58,108,0.22)' }}
          >
            <IconTruck size={26} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[16px]" style={{ color: 'var(--ink)' }}>
              {t('Turkiyaga yuk olib ketish')}
            </h3>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--muted)' }}>
              {t("Yo'lovchi sifatida pul ishlang")}
            </p>
          </div>
          <div className="shrink-0">
            {loading === 'carrier'
              ? <span className="w-5 h-5 border-2 rounded-full animate-spin block"
                  style={{ borderColor: 'var(--line2)', borderTopColor: 'var(--royal)' }} />
              : <IconChevronRight size={20} className="text-[var(--muted2)]" />
            }
          </div>
        </button>

        {/* Orderer */}
        <button
          onClick={() => selectRole('orderer', '/orderer')}
          disabled={loading !== null}
          className="press rounded-2xl p-5 flex items-center gap-4 text-left disabled:opacity-60 border"
          style={{ background: 'var(--surface)', borderColor: 'var(--line)', boxShadow: 'var(--shadow-md)' }}
        >
          <div
            className="w-[56px] h-[56px] rounded-[16px] flex items-center justify-center shrink-0"
            style={{ background: 'var(--surface2)', border: '1px solid var(--line2)', color: 'var(--muted)' }}
          >
            <IconBag size={26} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[16px]" style={{ color: 'var(--ink)' }}>
              {t('Buyurtma berish')}
            </h3>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--muted)' }}>
              {t('Mahsulot buyurtma qiling')}
            </p>
          </div>
          <div className="shrink-0">
            {loading === 'orderer'
              ? <span className="w-5 h-5 border-2 rounded-full animate-spin block"
                  style={{ borderColor: 'var(--line2)', borderTopColor: 'var(--royal)' }} />
              : <IconChevronRight size={20} className="text-[var(--muted2)]" />
            }
          </div>
        </button>

        {/* Staff login link */}
        <button
          onClick={() => navigate('/web-login')}
          className="press mt-1 py-3 rounded-2xl text-sm font-semibold transition-colors"
          style={{ color: 'var(--royal)' }}
        >
          {t('Xodim sifatida kirish')} →
        </button>
      </div>

      {error && (
        <div className="mx-5 mb-3 px-4 py-3 rounded-2xl text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.25)' }}>
          {error}
        </div>
      )}

      <p className="text-center text-xs pb-8" style={{ color: 'var(--muted2)' }}>
        Ali Bridge © 2026
      </p>
    </div>
  )
}
