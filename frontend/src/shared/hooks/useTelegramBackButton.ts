import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// Har rolning ildiz (bosh) sahifalari — bularda ortga tugma ko'rinmaydi
const ROOT_PATHS = new Set<string>([
  '/welcome',
  '/carrier',
  '/carrier/products',
  '/warehouse-uz',
  '/warehouse-tr',
  '/courier-uz',
  '/courier-tr',
  '/admin',
  '/orderer',
  '/china-worker',
])

/**
 * Telegram native BackButton'ni global boshqaradi.
 * - Ildiz sahifalarda yashiradi.
 * - Qolgan barcha oynalarda ko'rsatadi va bosilganda oldingi sahifaga qaytaradi.
 * Telegram tashqarisida (brauzer) — jim, hech narsa qilmaydi.
 */
export function useTelegramBackButton(): void {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const bb = window.Telegram?.WebApp?.BackButton
    if (!bb) return

    const path = location.pathname
    const isRoot = ROOT_PATHS.has(path)

    const handleBack = () => navigate(-1)

    if (isRoot) {
      bb.hide()
    } else {
      bb.show()
      bb.onClick(handleBack)
    }

    return () => {
      bb.offClick(handleBack)
    }
  }, [location.pathname, navigate])
}
