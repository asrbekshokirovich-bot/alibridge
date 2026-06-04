import { Routes, Route } from 'react-router-dom';
import { lazy } from 'react';

const Dashboard = lazy(() => import('./Dashboard'));
const SourcingTickets = lazy(() => import('./SourcingTickets'));
const MyShipments = lazy(() => import('./MyShipments'));

export default function ChinaRoutes() {
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="tickets" element={<SourcingTickets />} />
      <Route path="shipments" element={<MyShipments />} />
    </Routes>
  );
}
