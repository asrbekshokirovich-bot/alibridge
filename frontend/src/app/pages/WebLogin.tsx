import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useAuthStore } from '@/shared/store/auth'
import type { User } from '@/shared/types'
import { Button, Card, Input, IconPlane } from '@/shared/ui'
import { ROLE_HOME } from '@/app/router'

// Sayt (brauzer) orqali xodim/admin kirishi — login + parol.
// Telegram ichida bu sahifa ko'rsatilmaydi (u yerda avtomatik login bor).
export default function WebLogin() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      const res = await client.post<{ token: string; user: User }>('/auth/web-login', {
        username: username.trim(),
        password,
      })
      setAuth(res.data.token, res.data.user)
      navigate(ROLE_HOME[res.data.user.role] ?? '/', { replace: true })
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 animate-fade-in" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm mx-auto">
        <Card className="p-7">
          <div className="text-center mb-7">
            <div
              className="w-[60px] h-[60px] mx-auto rounded-[18px] flex items-center justify-center mb-4 text-white"
              style={{ background: 'linear-gradient(135deg,#1A3A6C,#132A4D)', boxShadow: '0 8px 20px rgba(26,58,108,0.22)' }}
            >
              <IconPlane size={30} />
            </div>
            <h1 className="text-2xl font-extrabold tracking-[-0.02em]" style={{ color: 'var(--ink)' }}>Ali Bridge</h1>
            <p className="text-sm mt-1.5" style={{ color: 'var(--muted)' }}>{t('Xodim kirishi')}</p>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3.5">
            <Input
              type="text"
              autoComplete="username"
              inputMode="text"
              placeholder={t('Login')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <Input
              type="password"
              autoComplete="current-password"
              placeholder={t('Parol')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {error && (
              <div className="text-sm px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.10)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.25)' }}>
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={loading}
              disabled={username.trim().length < 3 || password.length < 4}
              className="mt-1"
            >
              {t('Kirish')}
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs mt-7" style={{ color: 'var(--muted2)' }}>Ali Bridge © 2026</p>
      </div>
    </div>
  )
}
