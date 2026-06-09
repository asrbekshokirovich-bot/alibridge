import { useEffect, useState } from 'react'

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void
        expand: () => void
        close: () => void
        openLink: (url: string, options?: { try_instant_view?: boolean }) => void
        initData: string
        initDataUnsafe: {
          user?: {
            id: number
            first_name: string
            last_name?: string
            username?: string
          }
          start_param?: string
        }
        BackButton: {
          show: () => void
          hide: () => void
          onClick: (fn: () => void) => void
          offClick: (fn: () => void) => void
        }
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy') => void
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void
        }
        themeParams: {
          bg_color?: string
          text_color?: string
          button_color?: string
          button_text_color?: string
        }
      }
    }
  }
}

export function useTelegram() {
  const [isReady, setIsReady] = useState(false)
  const tg = window.Telegram?.WebApp

  useEffect(() => {
    if (tg) {
      tg.ready()
      tg.expand()
      // Telegram WebApp dark theme bilan moslash (header/fon)
      try {
        const anyTg = tg as unknown as {
          setHeaderColor?: (c: string) => void
          setBackgroundColor?: (c: string) => void
          enableClosingConfirmation?: () => void
        }
        anyTg.setHeaderColor?.('#0c0d12')
        anyTg.setBackgroundColor?.('#0c0d12')
      } catch {
        // eski Telegram versiyalari — e'tiborsiz
      }
      setIsReady(true)
    } else {
      // Development: Telegram yo'q bo'lsa ham ishlaydi
      setIsReady(true)
    }
  }, [tg])

  const haptic = (type: 'light' | 'medium' | 'heavy') => {
    tg?.HapticFeedback.impactOccurred(type)
  }

  const notify = (type: 'error' | 'success' | 'warning') => {
    tg?.HapticFeedback.notificationOccurred(type)
  }

  // Faylni/havolani tashqi brauzerda ochish — Telegram WebView ichida
  // <a download> ishlamaydi, openLink esa tizim brauzerida ochib yuklab oladi.
  const openLink = (url: string) => {
    if (tg?.openLink) {
      tg.openLink(url, { try_instant_view: false })
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  return {
    tg,
    isReady,
    initData: tg?.initData ?? '',
    tgUser: tg?.initDataUnsafe?.user,
    haptic,
    notify,
    openLink,
  }
}
