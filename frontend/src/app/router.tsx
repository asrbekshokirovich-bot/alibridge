import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { RoleGuard } from '@features/auth/RoleGuard';

// Lazy-load role-specific routes for smaller initial bundle
const OrdererRoutes = lazy(() => import('@features/orderer/routes'));
const CarrierRoutes = lazy(() => import('@features/carrier/routes'));
const WarehouseUzRoutes = lazy(() => import('@features/warehouse-uz/routes'));
const WarehouseTrRoutes = lazy(() => import('@features/warehouse-tr/routes'));
const ChinaRoutes = lazy(() => import('@features/china/routes'));
const CourierRoutes = lazy(() => import('@features/couriers/routes'));
const AdminRoutes = lazy(() => import('@features/admin/routes'));

const HomePage = lazy(() => import('@pages/HomePage'));
const NotFoundPage = lazy(() => import('@pages/NotFoundPage'));
const OnboardingPage = lazy(() => import('@pages/OnboardingPage'));

export function AppRouter() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />

        <Route
          path="/orderer/*"
          element={
            <RoleGuard allowedRoles={['orderer']}>
              <OrdererRoutes />
            </RoleGuard>
          }
        />

        <Route
          path="/carrier/*"
          element={
            <RoleGuard allowedRoles={['carrier']}>
              <CarrierRoutes />
            </RoleGuard>
          }
        />

        <Route
          path="/warehouse-uz/*"
          element={
            <RoleGuard allowedRoles={['warehouse_uz']}>
              <WarehouseUzRoutes />
            </RoleGuard>
          }
        />

        <Route
          path="/warehouse-tr/*"
          element={
            <RoleGuard allowedRoles={['warehouse_tr']}>
              <WarehouseTrRoutes />
            </RoleGuard>
          }
        />

        <Route
          path="/china/*"
          element={
            <RoleGuard allowedRoles={['china_worker']}>
              <ChinaRoutes />
            </RoleGuard>
          }
        />

        <Route
          path="/couriers/*"
          element={
            <RoleGuard allowedRoles={['courier_uz', 'courier_tr']}>
              <CourierRoutes />
            </RoleGuard>
          }
        />

        <Route
          path="/admin/*"
          element={
            <RoleGuard allowedRoles={['admin']}>
              <AdminRoutes />
            </RoleGuard>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
        <Route path="/404" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
