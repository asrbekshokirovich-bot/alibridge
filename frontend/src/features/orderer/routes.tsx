import { Routes, Route, Navigate } from 'react-router-dom'
import OrdererLayout from './OrdererLayout'
import Home from './pages/Home'
import Tracking from './pages/Tracking'
import Profile from './pages/Profile'

export default function OrdererRoutes() {
  return (
    <Routes>
      {/* Nav'siz: kuzatuv sahifasi */}
      <Route path="/track/:id" element={<Tracking />} />

      {/* Nav bilan asosiy sahifalar */}
      <Route element={<OrdererLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/orderer" replace />} />
    </Routes>
  )
}
