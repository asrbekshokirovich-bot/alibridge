import { Routes, Route } from 'react-router-dom';
import { lazy } from 'react';

const Dashboard = lazy(() => import('./Dashboard'));
const DispatchQueue = lazy(() => import('./DispatchQueue'));
const ScanSession = lazy(() => import('./ScanSession'));
const DeliveryHistory = lazy(() => import('./DeliveryHistory'));

export default function CourierRoutes() {
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="queue" element={<DispatchQueue />} />
      <Route path="scan" element={<ScanSession />} />
      <Route path="history" element={<DeliveryHistory />} />
    </Routes>
  );
}
