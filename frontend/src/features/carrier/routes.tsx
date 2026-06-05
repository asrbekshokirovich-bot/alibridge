import { Routes, Route, Navigate } from 'react-router-dom'
import CarrierLayout from './CarrierLayout'
import Products from './pages/Products'
import MyOrders from './pages/MyOrders'
import AutoReceive from './pages/AutoReceive'
import Checkout from './pages/Checkout'
import TicketForm from './pages/TicketForm'
import Profile from './pages/Profile'

export default function CarrierRoutes() {
  return (
    <Routes>
      {/* Nav'siz alohida sahifalar */}
      <Route path="/ticket" element={<TicketForm />} />
      <Route path="/checkout" element={<Checkout />} />

      {/* Nav bilan asosiy sahifalar */}
      <Route element={<CarrierLayout />}>
        <Route path="/" element={<Navigate to="/carrier/products" replace />} />
        <Route path="/products" element={<Products />} />
        <Route path="/my-orders" element={<MyOrders />} />
        <Route path="/auto-receive" element={<AutoReceive />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
    </Routes>
  )
}
