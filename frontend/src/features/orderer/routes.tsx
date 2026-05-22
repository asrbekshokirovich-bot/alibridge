import { Routes, Route } from 'react-router-dom';
import { lazy } from 'react';

const Dashboard = lazy(() => import('./Dashboard'));
const OrderList = lazy(() => import('./OrderList'));
const OrderCreate = lazy(() => import('./OrderCreate'));
const TrackOrder = lazy(() => import('./TrackOrder'));

export default function OrdererRoutes() {
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="orders" element={<OrderList />} />
      <Route path="orders/new" element={<OrderCreate />} />
      <Route path="orders/:orderId" element={<TrackOrder />} />
    </Routes>
  );
}
