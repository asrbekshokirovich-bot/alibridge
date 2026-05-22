import { Routes, Route } from 'react-router-dom';
import { lazy } from 'react';

const Dashboard = lazy(() => import('./Dashboard'));
const UserRoles = lazy(() => import('./UserRoles'));
const Disputes = lazy(() => import('./Disputes'));
const Payouts = lazy(() => import('./Payouts'));
const Products = lazy(() => import('./Products'));

export default function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="users" element={<UserRoles />} />
      <Route path="disputes" element={<Disputes />} />
      <Route path="payouts" element={<Payouts />} />
      <Route path="products" element={<Products />} />
    </Routes>
  );
}
