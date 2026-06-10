import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/shared/store/auth'
import { RoleGuard } from '@/shared/components/RoleGuard'
import { useTelegramBackButton } from '@/shared/hooks/useTelegramBackButton'

// Pages
import Welcome from './pages/Welcome'
import WebLogin from './pages/WebLogin'
import StaffPending from './pages/StaffPending'
import ComingSoon from './pages/ComingSoon'

// Telegram Mini App ichidamizmi? (initData bo'lsa — Telegram, aks holda brauzer/sayt)
const isTelegram = !!window.Telegram?.WebApp?.initData

// Features
import CarrierRoutes from '@/features/carrier/routes'
import WarehouseUzRoutes from '@/features/warehouse_uz/routes'
import WarehouseTrRoutes from '@/features/warehouse_tr/routes'
import CourierUzRoutes from '@/features/courier_uz/routes'
import CourierTrRoutes from '@/features/courier_tr/routes'
import AdminRoutes from '@/features/admin/routes'

// Har bir rol o'z paneliga yo'naltiriladi — Mini App oxirgi holatda ochiladi.
// pending (xodim so'rovi kutilmoqda) -> StaffPending, aks holda Welcome (rol tanlash).
export const ROLE_HOME: Record<string, string> = {
  orderer: '/orderer',
  carrier: '/carrier',
  warehouse_uz: '/warehouse-uz',
  warehouse_tr: '/warehouse-tr',
  courier_uz: '/courier-uz',
  courier_tr: '/courier-tr',
  admin: '/admin',
  china_worker: '/china-worker',
  pending: '/staff/pending',
}

function RootRedirect() {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  // Token + roli tayinlangan bo'lsa — to'g'ridan-to'g'ri o'z paneliga.
  // Token yo'q (o'chirilgan/qaytib kelgan user) bo'lsa — Welcome'ga (qayta login).
  // 'new' (hali rol tanlamagan) ROLE_HOME'da yo'q — Welcome'ga boradi.
  if (token && user && ROLE_HOME[user.role]) {
    return <Navigate to={ROLE_HOME[user.role]} replace />
  }
  // Brauzerda (Telegram emas) tokensiz — xodim login sahifasi
  if (!isTelegram) {
    return <Navigate to="/web-login" replace />
  }
  // Yangi foydalanuvchi ('new') yoki Telegram tashqarisi — rol tanlash ekrani
  return <Navigate to="/welcome" replace />
}

function AppRoutes() {
  // Telegram native ortga tugmasi — barcha rol va oynalar uchun
  useTelegramBackButton()

  return (
    <Routes>
      {/* Onboarding — ro'yxatdan o'tish botda, bu yerda faqat rol tanlanadi */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/web-login" element={<WebLogin />} />
      <Route path="/staff/pending" element={<StaffPending />} />

      {/* Carrier */}
      <Route path="/carrier/*" element={
        <RoleGuard role="carrier"><CarrierRoutes /></RoleGuard>
      } />

      {/* Warehouse UZ */}
      <Route path="/warehouse-uz/*" element={
        <RoleGuard role="warehouse_uz"><WarehouseUzRoutes /></RoleGuard>
      } />

      {/* Warehouse TR */}
      <Route path="/warehouse-tr/*" element={
        <RoleGuard role="warehouse_tr"><WarehouseTrRoutes /></RoleGuard>
      } />

      {/* Courier UZ */}
      <Route path="/courier-uz/*" element={
        <RoleGuard role="courier_uz"><CourierUzRoutes /></RoleGuard>
      } />

      {/* Courier TR */}
      <Route path="/courier-tr/*" element={
        <RoleGuard role="courier_tr"><CourierTrRoutes /></RoleGuard>
      } />

      {/* Admin */}
      <Route path="/admin/*" element={
        <RoleGuard role="admin"><AdminRoutes /></RoleGuard>
      } />

      {/* Orderer va China worker — hali ishlab chiqilmoqda */}
      <Route path="/orderer/*" element={
        <RoleGuard role="orderer"><ComingSoon title="Buyurtmachi paneli" /></RoleGuard>
      } />
      <Route path="/china-worker/*" element={
        <RoleGuard role="china_worker"><ComingSoon title="Xitoy ishchisi paneli" /></RoleGuard>
      } />

      <Route path="/unauthorized" element={
        <ComingSoon title="Ruxsat yo'q" subtitle="Bu bo'limga kirish huquqingiz yo'q" />
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function Router() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
