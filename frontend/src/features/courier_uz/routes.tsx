import { Routes, Route } from 'react-router-dom'
import Dashboard from './Dashboard'
import Queue from './pages/Queue'
import ScanPickup from './pages/ScanPickup'
import AirportHandover from './pages/AirportHandover'

export default function CourierUzRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/queue" element={<Queue />} />
      <Route path="/scan-pickup" element={<ScanPickup />} />
      <Route path="/airport-handover" element={<AirportHandover />} />
    </Routes>
  )
}
