import axios from 'axios'
import type { ApiError } from '@/shared/types'
import { getMock, getMockPost } from './mock'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// DEV: backend yo'q paytda soxta ma'lumot qaytaradi
if (USE_MOCK) {
  client.interceptors.request.use((config) => {
    config.adapter = async () => {
      await new Promise((r) => setTimeout(r, 300))
      const data =
        config.method === 'get'
          ? getMock(config.url ?? '')
          : getMockPost(config.url ?? '')
      return {
        data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    }
    return config
  })
}

// JWT token qo'shish
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Xato normalizatsiya
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.reload()
    }
    return Promise.reject(err)
  }
)

export function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiError | undefined
    return data?.error?.message ?? err.message
  }
  return 'Xatolik yuz berdi'
}

export default client
