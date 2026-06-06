import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { useAuthBootstrap } from '@/shared/hooks/useAuthBootstrap'
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="w-7 h-7 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  )
}
