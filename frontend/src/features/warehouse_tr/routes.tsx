import { Routes, Route } from 'react-router-dom'
import Dashboard from './Dashboard'
import ReceiveFromCarrier from './pages/ReceiveFromCarrier'
import HandoverCourierTr from './pages/HandoverCourierTr'
import WalkIn from './pages/WalkIn'
import UzProducts from './pages/UzProducts'
import DailyInReport from './pages/DailyInReport'
import HeldCargo from './pages/HeldCargo'
import Incoming from './pages/Incoming'

export default function WarehouseTrRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/receive-carrier" element={<ReceiveFromCarrier />} />
      <Route path="/handover-courier" element={<HandoverCourierTr />} />
      <Route path="/walk-in" element={<WalkIn />} />
      <Route path="/uz-products" element={<UzProducts />} />
      <Route path="/daily-report" element={<DailyInReport />} />
      <Route path="/held" element={<HeldCargo />} />
      <Route path="/incoming" element={<Incoming />} />
    </Routes>
  )
}
