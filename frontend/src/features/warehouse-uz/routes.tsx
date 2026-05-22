import { Routes, Route } from 'react-router-dom';
import { lazy } from 'react';

const Dashboard = lazy(() => import('./Dashboard'));
const Intake = lazy(() => import('./Intake'));
const QuickIntake = lazy(() => import('./QuickIntake'));
const ScanSession = lazy(() => import('./ScanSession'));
const LabelPrint = lazy(() => import('./LabelPrint'));

export default function WarehouseUzRoutes() {
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="intake" element={<Intake />} />
      <Route path="quick-intake" element={<QuickIntake />} />
      <Route path="scan" element={<ScanSession />} />
      <Route path="labels" element={<LabelPrint />} />
    </Routes>
  );
}
