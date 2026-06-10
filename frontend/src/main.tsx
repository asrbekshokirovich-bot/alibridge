import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Telegram Mini App ichida emasmiz (initData yo'q) — bu brauzer/sayt.
// <html class="web"> CSS'da keng desktop layout'ni yoqadi (Telegram telefon tor qoladi).
if (!window.Telegram?.WebApp?.initData) {
  document.documentElement.classList.add('web')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
