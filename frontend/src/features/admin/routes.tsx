import { Routes, Route } from 'react-router-dom'
import Dashboard from './Dashboard'
import StaffApproval from './pages/StaffApproval'
import Staff from './pages/Staff'
import Carriers from './pages/Carriers'
import Disputes from './pages/Disputes'
import Payments from './pages/Payments'
import Products from './pages/Products'
import ViewAs from './pages/ViewAs'
import MyCredentials from './pages/MyCredentials'
import DailyReport from './pages/DailyReport'

export default function AdminRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/staff-approval" element={<StaffApproval />} />
      <Route path="/staff" element={<Staff />} />
      <Route path="/carriers" element={<Carriers />} />
      <Route path="/disputes" element={<Disputes />} />
      <Route path="/payments" element={<Payments />} />
      <Route path="/products" element={<Products />} />
      <Route path="/view-as" element={<ViewAs />} />
      <Route path="/my-credentials" element={<MyCredentials />} />
      <Route path="/daily-report" element={<DailyReport />} />
    </Routes>
  )
}
