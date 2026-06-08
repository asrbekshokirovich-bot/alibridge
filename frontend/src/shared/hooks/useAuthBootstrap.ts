import { useEffect, useState } from 'react'
import client from '@/shared/api/client'
import { useAuthStore } from '@/shared/store/auth'
import type { User } from '@/shared/types'

interface LoginResponse {
  token: string
  user: User
}

// VAQTINCHALIK DIAGNOSTIKA — login nega ishlamayotganini Welcome'da ko'rsatish uchun
export const authDebug: { info: string } = { info: 'boot...' }

/**
 * App ishga tushganda:
 * - Token bor bo'lsa  -> /auth/me bilan joriy rolni sinxronlaymiz (rol DB'da o'zgargan bo'lsa).
 * - Token yo'q bo'lsa -> Telegram initData bilan avtomatik login (ro'yxatda bo'lsa kiradi).
 * 401/404 bo'lsa eskirgan sessiya tozalanadi va Welcome ko'rsatiladi.
 */
export function useAuthBootstrap(): boolean {
  const token = useAuthStore((s) => s.token)
  const setAuth = useAuthStore((s) => s.setAuth)
  const setUser = useAuthStore((s) => s.setUser)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      // 1) Token bor — joriy rolni serverdan yangilaymiz
      if (token) {
        try {
          const res = await client.get<User>('/auth/me')
          if (!cancelled) setUser(res.data)
        } catch (err: unknown) {
          const status = (err as { response?: { status?: number } })?.response?.status
          if (!cancelled && status === 401) {
            clearAuth()
            localStorage.removeItem('carrier_ticket')
          }
        }
        return
      }

      // 2) Token yo'q — Telegram initData bilan avtomatik login
      const initData = window.Telegram?.WebApp?.initData ?? ''
      const hasTg = !!window.Telegram?.WebApp
      const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user
      authDebug.info = `tg=${hasTg} initLen=${initData.length} uid=${tgUser?.id ?? '-'} base=${client.defaults.baseURL}`
      if (!initData) {
        authDebug.info += ' | initData BO\'SH — Telegram tashqarisida yoki SDK yuklanmadi'
        return // Telegram tashqarisida — Welcome ko'rsatiladi
      }

      try {
        const res = await client.post<LoginResponse>('/auth/login', {
          tg_init_data: initData,
        })
        if (!cancelled) setAuth(res.data.token, res.data.user)
        authDebug.info += ` | LOGIN OK role=${res.data.user.role}`
      } catch (err: unknown) {
        const e = err as {
          response?: { status?: number; data?: { error?: { code?: string; message?: string } } }
          message?: string
        }
        const status = e?.response?.status
        const code = e?.response?.data?.error?.code
        const msg = e?.response?.data?.error?.message
        authDebug.info += ` | LOGIN FAIL status=${status ?? 'NETWORK'} code=${code ?? '-'} msg=${msg ?? e?.message ?? '-'}`
        // Ro'yxatda yo'q (404) yoki boshqa xato — Welcome ko'rsatiladi
      }
    }

    bootstrap().finally(() => {
      if (!cancelled) setReady(true)
    })

    return () => {
      cancelled = true
    }
    // faqat bir marta (mount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return ready
}
