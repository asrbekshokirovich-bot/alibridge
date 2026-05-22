import { Routes, Route } from 'react-router-dom';
import { lazy } from 'react';

const Dashboard = lazy(() => import('./Dashboard'));
const ReceiveCarrier = lazy(() => import('./ReceiveCarrier'));
const FinalHandoff = lazy(() => import('./FinalHandoff'));

export default function WarehouseTrRoutes() {
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="receive" element={<ReceiveCarrier />} />
      <Route path="handoff" element={<FinalHandoff />} />
    </Routes>
  );
}
