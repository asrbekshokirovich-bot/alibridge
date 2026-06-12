import { Routes, Route } from 'react-router-dom'
import Dashboard from './Dashboard'
import Queue from './pages/Queue'
import ScanPickup from './pages/ScanPickup'
import AirportHandover from './pages/AirportHandover'
import MyProducts from './pages/MyProducts'

export default function CourierUzRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/queue" element={<Queue />} />
      <Route path="/scan-pickup" element={<ScanPickup />} />
      <Route path="/my-products" element={<MyProducts />} />
      <Route path="/airport-handover" element={<AirportHandover />} />
    </Routes>
  )
}
