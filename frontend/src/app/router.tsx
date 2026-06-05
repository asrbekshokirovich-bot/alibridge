import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/shared/store/auth'
import { RoleGuard } from '@/shared/components/RoleGuard'
import { IS_DEV } from '@/shared/config'

// Pages
import Welcome from './pages/Welcome'
import Register from './pages/Register'
import StaffPending from './pages/StaffPending'
import DevLogin from './pages/DevLogin'
import ComingSoon from './pages/ComingSoon'

// Features
import CarrierRoutes from '@/features/carrier/routes'
import WarehouseUzRoutes from '@/features/warehouse_uz/routes'
import WarehouseTrRoutes from '@/features/warehouse_tr/routes'
import CourierUzRoutes from '@/features/courier_uz/routes'
import CourierTrRoutes from '@/features/courier_tr/routes'
import AdminRoutes from '@/features/admin/routes'

// Har bir rol uchun bosh sahifa yo'li
const ROLE_HOME: Record<string, string> = {
  carrier: '/carrier',
  warehouse_uz: '/warehouse-uz',
  warehouse_tr: '/warehouse-tr',
  courier_uz: '/courier-uz',
  courier_tr: '/courier-tr',
  admin: '/admin',
  orderer: '/orderer',
  china_worker: '/china-worker',
}

function RootRedirect() {
  const user = useAuthStore((s) => s.user)
  if (!user) {
    // Test rejimda — to'g'ridan-to'g'ri dev panelga
    if (IS_DEV) return <Navigate to="/dev" replace />
    return <Navigate to="/welcome" replace />
  }
  return <Navigate to={ROLE_HOME[user.role] ?? '/welcome'} replace />
}

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Onboarding */}
        <Route path="/" element={<RootRedirect />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/register/:type" element={<Register />} />
        <Route path="/carrier/register" element={<Register />} />
        <Route path="/orderer/register" element={<Register />} />
        <Route path="/staff/register" element={<Register />} />
        <Route path="/staff/pending" element={<StaffPending />} />

        {/* DEV — faqat test rejimda ro'yxatga olinadi (production'da yo'q) */}
        {IS_DEV && <Route path="/dev" element={<DevLogin />} />}

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
    </BrowserRouter>
  )
}
