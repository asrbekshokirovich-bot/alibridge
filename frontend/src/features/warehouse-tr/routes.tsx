import { Routes, Route } from 'react-router-dom';
import { lazy } from 'react';

const Dashboard = lazy(() => import('./Dashboard'));
const ReceiveCarrier = lazy(() => import('./ReceiveCarrier'));
const FinalHandoff = lazy(() => import('./FinalHandoff'));
const Products = lazy(() => import('@features/admin/Products'));
const CarrierTracker = lazy(() => import('@features/admin/CarrierTracker'));
const Debts = lazy(() => import('@features/admin/Debts'));

export default function WarehouseTrRoutes() {
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="receive" element={<ReceiveCarrier />} />
      <Route path="handoff" element={<FinalHandoff />} />
      {/* Faqat kuzatish — admin komponentlari readOnly rejimda */}
      <Route path="products" element={<Products readOnly />} />
      <Route path="carriers" element={<CarrierTracker />} />
      <Route path="debts" element={<Debts readOnly />} />
    </Routes>
  );
}
