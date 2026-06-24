import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { useAuthStore } from '@/shared/store/auth'
import type { User } from '@/shared/types'
import { Header, Input, Button } from '@/shared/ui'

// Admin (yoki xodim) o'ziga sayt orqali kirish uchun login + parol o'rnatadi.
export default function MyCredentials() {
  const { t } = useTranslation()
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
      alert(t('Sayt logini o\'rnatildi. Endi brauzerda shu login bilan kira olasiz.'))
    },
    onError: (err) => { alert(extractErrorMessage(err)); notify('error') },
  })

  const valid = username.trim().length >= 3 && password.length >= 4

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title={t('Sayt logini')} subtitle={t('Brauzer orqali kirish')} showBack />

      <div className="px-4 pt-4">
        <div className="rounded-2xl p-4 border" style={{ background: 'var(--card-gradient)', borderColor: 'var(--line2)', boxShadow: 'var(--shadow-md)' }}>
          <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
            {t('Saytga (brauzerda) kirish uchun o\'zingizga login va parol o\'rnating.')}
            {user?.username && (
              <span className="block mt-1 font-semibold" style={{ color: 'var(--green)' }}>{t('Joriy login: {{username}}', { username: user.username })}</span>
            )}
          </p>

          <div className="flex flex-col gap-2.5">
            <Input
              type="text"
              autoComplete="username"
              placeholder={t('Login')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <Input
              type="text"
              placeholder={t('Parol')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              variant="primary"
              fullWidth
              loading={save.isPending}
              disabled={!valid}
              onClick={() => save.mutate()}>
              {user?.username ? t('Loginni yangilash') : t('Login o\'rnatish')}
            </Button>
          </div>

          <p className="text-xs mt-3" style={{ color: 'var(--muted2)' }}>
            {t('Login kamida 3 belgi, parol kamida 4 belgi bo\'lishi kerak.')}
          </p>
        </div>
      </div>
    </div>
  )
}
