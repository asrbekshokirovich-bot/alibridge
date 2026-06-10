import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { useAuthStore } from '@/shared/store/auth'
import type { User } from '@/shared/types'
import { Header } from '@/shared/ui'

// Admin (yoki xodim) o'ziga sayt orqali kirish uchun login + parol o'rnatadi.
export default function MyCredentials() {
  const { notify } = useTelegram()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const save = useMutation({
    mutationFn: () =>
      client
        .post<User>('/auth/my-credentials', { username: username.trim(), password })
        .then((r) => r.data),
    onSuccess: (u) => {
      notify('success')
      setUser(u)
      setUsername('')
      setPassword('')
      alert('Sayt logini o\'rnatildi. Endi brauzerda shu login bilan kira olasiz.')
    },
    onError: (err) => { alert(extractErrorMessage(err)); notify('error') },
  })

  const valid = username.trim().length >= 3 && password.length >= 4

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title="Sayt logini" subtitle="Brauzer orqali kirish" showBack />

      <div className="px-4 pt-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <p className="text-sm text-slate-600 mb-3">
            Saytga (brauzerda) kirish uchun o'zingizga login va parol o'rnating.
            {user?.username && (
              <span className="block mt-1 text-emerald-600 font-medium">Joriy login: {user.username}</span>
            )}
          </p>

          <div className="flex flex-col gap-2.5">
            <input
              type="text"
              autoComplete="username"
              placeholder="Login"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-slate-50 rounded-xl px-4 py-3 text-sm border border-slate-200 outline-none focus:border-slate-400"
            />
            <input
              type="text"
              placeholder="Parol"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-50 rounded-xl px-4 py-3 text-sm border border-slate-200 outline-none focus:border-slate-400"
            />
            <button
              onClick={() => save.mutate()}
              disabled={!valid || save.isPending}
              className="press py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'var(--brand-gradient)' }}>
              {save.isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {user?.username ? 'Loginni yangilash' : 'Login o\'rnatish'}
            </button>
          </div>

          <p className="text-xs text-slate-400 mt-3">
            Login kamida 3 belgi, parol kamida 4 belgi bo'lishi kerak.
          </p>
        </div>
      </div>
    </div>
  )
}
