import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { useAuthBootstrap } from '@/shared/hooks/useAuthBootstrap'
import { SplashScreen } from '@/shared/ui'
import Router from './app/router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

export default function App() {
  // Telegram SDK'ni root'da ishga tushiramiz (ready + expand)
  useTelegram()
  // Token bo'lsa — server'dan joriy rolni sinxronlaymiz (eski localStorage tuzatish)
  const ready = useAuthBootstrap()

  if (!ready) {
    return <SplashScreen />
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  )
}
