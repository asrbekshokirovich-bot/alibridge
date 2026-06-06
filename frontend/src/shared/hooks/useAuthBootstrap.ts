import { useEffect, useState } from 'react'
import client from '@/shared/api/client'
import { useAuthStore } from '@/shared/store/auth'
import type { User } from '@/shared/types'

interface LoginResponse {
  token: string
  user: User
}

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
      if (!initData) return // Telegram tashqarisida — Welcome ko'rsatiladi

      try {
        const res = await client.post<LoginResponse>('/auth/login', {
          tg_init_data: initData,
        })
        if (!cancelled) setAuth(res.data.token, res.data.user)
      } catch {
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
