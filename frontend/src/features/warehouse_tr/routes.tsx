import { Routes, Route } from 'react-router-dom'
import Dashboard from './Dashboard'
import ReceiveFromCarrier from './pages/ReceiveFromCarrier'
import HandoverCourierTr from './pages/HandoverCourierTr'
import WalkIn from './pages/WalkIn'
import UzProducts from './pages/UzProducts'

export default function WarehouseTrRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/receive-carrier" element={<ReceiveFromCarrier />} />
      <Route path="/handover-courier" element={<HandoverCourierTr />} />
      <Route path="/walk-in" element={<WalkIn />} />
      <Route path="/uz-products" element={<UzProducts />} />
    </Routes>
  )
}
