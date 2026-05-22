import { Routes, Route } from 'react-router-dom';
import { lazy } from 'react';

const TicketList = lazy(() => import('./TicketList'));

export default function ChinaRoutes() {
  return (
    <Routes>
      <Route index element={<TicketList />} />
    </Routes>
  );
}
