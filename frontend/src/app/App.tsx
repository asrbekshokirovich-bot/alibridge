import { useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouter } from './router';
import { BackButtonManager } from './BackButtonManager';
import { BackButtonProvider } from '@shared/context/BackButtonContext';
import { initTelegramApp } from '@shared/utils/telegram';
import '@shared/i18n/config'; // til aniqlash va i18n init shu faylda bajariladi

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60, // 1 minute
    },
  },
});

export function App() {
  useEffect(() => {
    // Initialize Telegram Mini App
    initTelegramApp();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/*
        MemoryRouter ishlatiladi (BrowserRouter emas) — Telegram Mini App'da
        window.history.go(-1) WebView'ni yopadi. MemoryRouter navigatsiyani
        xotirada saqlaydi, brauzer tarixisiga ta'sir qilmaydi.
      */}
      <MemoryRouter initialEntries={['/']} initialIndex={0}>
        <BackButtonProvider>
          {/* Route chuqurligiga qarab BackButton avtomatik ko'rsatiladi/yashiriladi */}
          <BackButtonManager />
          <AppRouter />
        </BackButtonProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
