import { Routes, Route } from 'react-router-dom'
import Dashboard from './Dashboard'
import ReceiveGoods from './pages/ReceiveGoods'
import Orders from './pages/Orders'
import Products from './pages/Products'
import EditProduct from './pages/EditProduct'
import Disputes from './pages/Disputes'
import Carriers from './pages/Carriers'
import AllProducts from './pages/AllProducts'
import DailyReport from './pages/DailyReport'

export default function WarehouseUzRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/receive" element={<ReceiveGoods />} />
      <Route path="/orders" element={<Orders />} />
      <Route path="/products" element={<Products />} />
      <Route path="/products/:id/edit" element={<EditProduct />} />
      <Route path="/disputes" element={<Disputes />} />
      <Route path="/carriers" element={<Carriers />} />
      <Route path="/all-products" element={<AllProducts />} />
      <Route path="/daily-report" element={<DailyReport />} />
    </Routes>
  )
}
