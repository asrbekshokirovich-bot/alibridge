import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTelegram } from '@/shared/hooks/useTelegram'
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

  return (
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  )
}
