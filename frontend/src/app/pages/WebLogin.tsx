import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useAuthStore } from '@/shared/store/auth'
import type { User } from '@/shared/types'
import { IconPlane } from '@/shared/ui'
import { ROLE_HOME } from '@/app/router'

// Sayt (brauzer) orqali xodim/admin kirishi — login + parol.
// Telegram ichida bu sahifa ko'rsatilmaydi (u yerda avtomatik login bor).
export default function WebLogin() {
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
    <div className="min-h-screen flex flex-col justify-center px-6 animate-fade-in">
      <div className="w-full max-w-sm mx-auto">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-5 shadow-[var(--shadow-brand)]"
            style={{ background: 'var(--brand-gradient)' }}>
            <IconPlane size={38} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Ali Bridge</h1>
          <p className="text-sm text-slate-500 mt-1.5">Xodim kirishi</p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3.5">
          <input
            type="text"
            autoComplete="username"
            inputMode="text"
            placeholder="Login"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="bg-white rounded-2xl px-4 py-3.5 border border-slate-200 outline-none focus:border-slate-400 text-slate-900"
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Parol"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-white rounded-2xl px-4 py-3.5 border border-slate-200 outline-none focus:border-slate-400 text-slate-900"
          />

          {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl">{error}</div>}

          <button
            type="submit"
            disabled={loading || username.trim().length < 3 || password.length < 4}
            className="press w-full text-white rounded-2xl py-4 font-bold shadow-[var(--shadow-brand)] disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: 'var(--brand-gradient)' }}
          >
            {loading
              ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : 'Kirish'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-8">Ali Bridge © 2026</p>
      </div>
    </div>
  )
}
