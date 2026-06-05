import { Routes, Route } from 'react-router-dom'
import Dashboard from './Dashboard'
import ReceiveFromUZ from './pages/ReceiveFromUZ'
import Deliver from './pages/Deliver'

export default function CourierTrRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/receive-from-uz" element={<ReceiveFromUZ />} />
      <Route path="/deliver" element={<Deliver />} />
    </Routes>
  )
}
