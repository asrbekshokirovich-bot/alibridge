import { Routes, Route } from 'react-router-dom';
import { lazy } from 'react';

const Dashboard = lazy(() => import('./Dashboard'));
const Catalog = lazy(() => import('./Catalog'));
const Basket = lazy(() => import('./Basket'));
const Onboarding = lazy(() => import('./Onboarding'));
const Picks = lazy(() => import('./Picks'));
const Scanner = lazy(() => import('./Scanner'));

export default function CarrierRoutes() {
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="onboarding" element={<Onboarding />} />
      <Route path="catalog" element={<Catalog />} />
      <Route path="basket" element={<Basket />} />
      <Route path="picks" element={<Picks />} />
      <Route path="scan" element={<Scanner />} />
    </Routes>
  );
}
