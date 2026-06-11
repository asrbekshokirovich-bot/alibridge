import axios from 'axios'
import type { ApiError } from '@/shared/types'

// Content-Type'ni qo'lda o'rnatmaymiz: axios JSON uchun application/json,
// FormData (rasm) uchun multipart/form-data + boundary'ni o'zi qo'yadi.
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api/v1',
})

// JWT token qo'shish
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Xato normalizatsiya + network uzilishida qayta urinish.
// Render starter plan deploy/cold start paytida ulanish uzilishi mumkin.
// FAQAT GET (idempotent) so'rovlarni qayta urinamiz — POST/DELETE qayta
// yuborilsa ikki marta bajarilishi mumkin (masalan, bir yuk ikki marta o'chadi).
client.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      return Promise.reject(err)
    }
    const cfg = err.config as (typeof err.config & { _retryCount?: number }) | undefined
    const isGet = (cfg?.method ?? 'get').toLowerCase() === 'get'
    // Javobsiz (network/timeout) xato + GET + bekor qilinmagan bo'lsa qayta urinamiz
    if (cfg && isGet && !err.response && !axios.isCancel(err)) {
      cfg._retryCount = (cfg._retryCount ?? 0) + 1
      if (cfg._retryCount <= 2) {
        await new Promise((r) => setTimeout(r, (cfg._retryCount as number) * 1000))
        return client(cfg)
      }
    }
    return Promise.reject(err)
  }
)

export function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiError | undefined
    if (data?.error?.message) return data.error.message
    // Server javob bermadi — ulanish/timeout (Render cold start yoki deploy paytida)
    if (!err.response) {
      return 'Serverga ulanib bo\'lmadi — internetni tekshiring yoki bir oz kutib qayta urinib ko\'ring.'
    }
    return err.message
  }
  return 'Xatolik yuz berdi'
}

export default client
