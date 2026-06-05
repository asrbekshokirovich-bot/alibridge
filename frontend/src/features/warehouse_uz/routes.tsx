import { Routes, Route } from 'react-router-dom'
import Dashboard from './Dashboard'
import ReceiveGoods from './pages/ReceiveGoods'
import WeighAndLabel from './pages/WeighAndLabel'
import HandoverCarrier from './pages/HandoverCarrier'
import HandoverCourier from './pages/HandoverCourier'

export default function WarehouseUzRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/receive" element={<ReceiveGoods />} />
      <Route path="/weigh" element={<WeighAndLabel />} />
      <Route path="/handover-carrier" element={<HandoverCarrier />} />
      <Route path="/handover-courier" element={<HandoverCourier />} />
    </Routes>
  )
}
