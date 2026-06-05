import { Routes, Route } from 'react-router-dom'
import Dashboard from './Dashboard'
import StaffApproval from './pages/StaffApproval'
import Carriers from './pages/Carriers'
import Disputes from './pages/Disputes'
import Payments from './pages/Payments'

export default function AdminRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/staff-approval" element={<StaffApproval />} />
      <Route path="/carriers" element={<Carriers />} />
      <Route path="/disputes" element={<Disputes />} />
      <Route path="/payments" element={<Payments />} />
    </Routes>
  )
}
