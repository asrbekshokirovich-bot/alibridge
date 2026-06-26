import { Routes, Route } from 'react-router-dom'
import Dashboard from './Dashboard'
import AirportHandover from './pages/AirportHandover'
import CarrierHandover from './pages/CarrierHandover'
import MyProducts from './pages/MyProducts'

export default function CourierUzRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/my-products" element={<MyProducts />} />
      <Route path="/carrier-handover" element={<CarrierHandover />} />
      <Route path="/airport-handover" element={<AirportHandover />} />
    </Routes>
  )
}
