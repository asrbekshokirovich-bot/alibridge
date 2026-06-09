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

// Xato normalizatsiya — 401 bo'lsa eskirgan sessiyani tozalaymiz
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
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
