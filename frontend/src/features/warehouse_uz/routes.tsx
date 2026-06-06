import { Routes, Route } from 'react-router-dom'
import Dashboard from './Dashboard'
import ReceiveGoods from './pages/ReceiveGoods'
import Orders from './pages/Orders'
import Products from './pages/Products'
import HandoverCourier from './pages/HandoverCourier'

export default function WarehouseUzRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/receive" element={<ReceiveGoods />} />
      <Route path="/orders" element={<Orders />} />
      <Route path="/products" element={<Products />} />
      <Route path="/handover-courier" element={<HandoverCourier />} />
    </Routes>
  )
}
