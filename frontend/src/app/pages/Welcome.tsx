import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { useAuthStore } from '@/shared/store/auth'
import { IconPlane, IconBag, IconChevronRight } from '@/shared/ui'
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
      <div className="relative px-6 pt-16 pb-10 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 55% 40% at 50% -5%, rgba(255,77,94,0.12) 0%, transparent 60%)',
        }} />
        <div className="relative flex items-center gap-3 mb-5">
          <div className="w-[42px] h-[42px] rounded-[13px] flex items-center justify-center"
            style={{ background: 'var(--brand-gradient)', boxShadow: '0 10px 28px -6px rgba(255,77,94,0.6), inset 0 1px 1px rgba(255,255,255,0.25)' }}>
            <IconPlane size={22} className="text-white" />
          </div>
          <span className="text-[11px] font-bold tracking-[0.26em] uppercase" style={{ color: 'var(--text-dim)' }}>
            ALI BRIDGE · Mini App
          </span>
        </div>
        <h1 className="relative text-[34px] font-black tracking-[-0.025em] leading-none mb-2.5" style={{ color: 'var(--text)' }}>
          ALI BRIDGE
        </h1>
        <p className="relative text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('Toshkent (TAS) → Istanbul (IST) · Kargo logistikasi')}
        </p>
      </div>

      {/* Rol kartalari */}
      <div className="flex-1 flex flex-col gap-3 px-5 pb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: 'var(--text-dim)' }}>
          {t('Rolni tanlang')}
        </p>

        {/* Carrier — yagona qizil aksent */}
        <button
          onClick={() => selectRole('carrier', '/carrier')}
          disabled={loading !== null}
          className="press relative overflow-hidden rounded-[20px] p-5 flex items-center gap-4 text-left disabled:opacity-60 border"
          style={{ background: 'var(--card)', borderColor: 'var(--brand-tint-border)' }}
        >
          <div className="absolute -top-6 -right-4 w-[110px] h-[110px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle,rgba(255,77,94,0.12),transparent 70%)' }} />
          <div className="relative w-[54px] h-[54px] rounded-2xl flex items-center justify-center text-white shrink-0"
            style={{ background: 'var(--brand-gradient)', boxShadow: 'var(--shadow-brand)' }}>
            <IconPlane size={24} />
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
              : <span style={{ color: 'var(--brand)' }}><IconChevronRight size={20} /></span>
            }
          </div>
        </button>

        {/* Orderer — neytral */}
        <button
          onClick={() => selectRole('orderer', '/orderer')}
          disabled={loading !== null}
          className="press relative overflow-hidden rounded-[20px] p-5 flex items-center gap-4 text-left disabled:opacity-60 border"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div className="relative w-[54px] h-[54px] rounded-2xl flex items-center justify-center shrink-0 border"
            style={{ background: 'var(--card-2)', borderColor: 'var(--border-strong)', color: 'var(--text-2)' }}>
            <IconBag size={24} />
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
                  style={{ borderColor: 'var(--border)', borderTopColor: 'var(--text-2)' }} />
              : <span style={{ color: 'var(--text-ghost)' }}><IconChevronRight size={20} /></span>
            }
          </div>
        </button>

        {/* Xodim login */}
        <button
          onClick={() => navigate('/web-login')}
          className="press mt-1 py-3 rounded-2xl text-sm font-medium transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          {t('Xodim sifatida kirish')} →
        </button>
      </div>

      {error && (
        <div className="mx-5 mb-3 px-4 py-3 rounded-2xl text-sm"
          style={{ background: 'var(--brand-tint)', color: 'var(--brand-light)', border: '1px solid var(--brand-tint-border)' }}>
          {error}
        </div>
      )}

      <p className="text-center text-xs pb-8" style={{ color: 'var(--text-dim)' }}>
        Ali Bridge © 2026
      </p>
    </div>
  )
}
