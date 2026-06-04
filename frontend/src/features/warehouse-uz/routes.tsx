import { Routes, Route } from 'react-router-dom';
import { lazy } from 'react';

const Dashboard = lazy(() => import('./Dashboard'));
const Intake = lazy(() => import('./Intake'));
const QuickIntake = lazy(() => import('./QuickIntake'));
const ScanSession = lazy(() => import('./ScanSession'));
const LabelPrint = lazy(() => import('./LabelPrint'));
const ProductsList = lazy(() => import('./ProductsList'));
const DailyReport = lazy(() => import('./DailyReport'));
const PendingPickups = lazy(() => import('./PendingPickups'));
const PendingApprovals = lazy(() => import('./PendingApprovals'));
const Catalog = lazy(() => import('@features/carrier/Catalog'));

export default function WarehouseUzRoutes() {
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="intake" element={<Intake />} />
      <Route path="quick-intake" element={<QuickIntake />} />
      <Route path="scan" element={<ScanSession />} />
      <Route path="labels" element={<LabelPrint />} />
      <Route path="products" element={<ProductsList />} />
      <Route path="catalog" element={<Catalog readOnly />} />
      <Route path="daily-report" element={<DailyReport />} />
      <Route path="pending-pickups" element={<PendingPickups />} />
      <Route path="pending-approvals" element={<PendingApprovals />} />
    </Routes>
  );
}
