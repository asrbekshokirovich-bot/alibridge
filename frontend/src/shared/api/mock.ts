// DEV mock — backend yo'q paytda frontend'ni sinash uchun soxta ma'lumotlar.
// Faqat dev rejimda ishlaydi (VITE_USE_MOCK=true yoki backend yo'q).

import type { Product, CarrierOrder } from '@/shared/types'

const mockProducts: Product[] = [
  { id: 1, barcode: 'KRS-001', name: 'Krasovka Nike', category: 'Poyabzal', type: 'piece', quantity: 600, weight_kg: 480, unit_weight_kg: 0.8, cargo_price: 50000, status: 'in_warehouse_uz' },
  { id: 2, barcode: 'TEX-001', name: 'Tekstil mato', category: 'Tekstil', type: 'weight', quantity: 200, weight_kg: 500, box_weight_kg: 5, cargo_price: 30000, status: 'in_warehouse_uz' },
  { id: 3, barcode: 'PHN-001', name: 'Telefon g\'ilofi', category: 'Aksessuar', type: 'piece', quantity: 1000, weight_kg: 100, unit_weight_kg: 0.1, cargo_price: 10000, status: 'in_warehouse_uz' },
  { id: 4, barcode: 'JEA-001', name: 'Jinsi shim', category: 'Tekstil', type: 'weight', quantity: 150, weight_kg: 300, box_weight_kg: 4, cargo_price: 35000, status: 'in_warehouse_uz' },
]

const mockOrders: CarrierOrder[] = [
  {
    id: 101, carrier_id: 1, pickup_type: 'self', delivery_address_tr: 'Istanbul, Fatih', status: 'pending_admin', created_at: '2026-06-01',
    products: [mockProducts[0]],
  },
  {
    id: 102, carrier_id: 1, pickup_type: 'courier', pickup_address: 'Toshkent, Chilonzor', delivery_address_tr: 'Ankara', status: 'with_carrier', created_at: '2026-06-02',
    products: [mockProducts[1], mockProducts[2]],
  },
]

// POST javoblari uchun mock (URL bo'yicha)
export function getMockPost(url: string): unknown {
  if (url.includes('/warehouse-uz/receive')) {
    return { barcode: 'ALB-100001', name: 'Yangi mahsulot', received_date: '06.06.2026', print_url: '#', quantity: 600 }
  }
  // boshqa POST'lar oddiy ok
  return { ok: true }
}

// URL → mock javob xaritasi (GET)
export function getMock(url: string): unknown {
  if (url.includes('/products/catalog')) return mockProducts
  if (url.includes('/carrier/orders')) return mockOrders
  if (url.includes('/couriers/uz/active')) return [
    { id: 1, first_name: 'Aziz', last_name: 'Karimov' },
    { id: 2, first_name: 'Bobur', last_name: 'Aliyev' },
  ]
  if (url.includes('/warehouse-uz/stats')) return { pending_receive: 3, in_warehouse: 12, pending_handover: 2 }
  if (url.includes('/warehouse-uz/pending-weigh')) return [
    { order_id: 1, carrier_name: 'Sardor Aliyev', carrier_number: 47, product_name: 'Tekstil mato', requested_kg: 10 },
  ]
  if (url.includes('/courier-uz/queue')) return [
    { id: 1, carrier_name: 'Sardor Aliyev', carrier_number: 47, address: 'Chilonzor 5-uy', products_count: 3, status: 'pending' },
  ]
  if (url.includes('/courier-tr/deliveries')) return [
    { id: 1, address: 'Istanbul, Fatih mah.', recipient_name: 'Murod', products_count: 2, barcodes: ['KRS-001', 'TEX-001'] },
  ]
  if (url.includes('/warehouse-tr/uz-products')) return mockProducts
  if (url.includes('/admin/stats')) return { pending_staff: 2, active_carriers: 15, total_products: 340, open_disputes: 1, unpaid_payments: 4 }
  if (url.includes('/admin/staff-requests')) return [
    { id: 1, first_name: 'Jasur', last_name: 'Toshmatov', phone: '+998901112233', created_at: '2026-06-05' },
  ]
  if (url.includes('/admin/carriers')) return [
    { id: 1, first_name: 'Sardor', last_name: 'Aliyev', phone: '+998901234567', carrier_number: 47, is_active: true, total_trips: 12 },
  ]
  if (url.includes('/admin/disputes')) return [
    { id: 1, product_name: 'Krasovka', barcode: 'KRS-001', carrier_name: 'Sardor', carrier_number: 47, note: 'Quti ezilgan', status: 'open', created_at: '2026-06-04' },
  ]
  if (url.includes('/admin/payments')) return [
    { id: 1, carrier_name: 'Sardor Aliyev', carrier_number: 47, products_count: 3, total_amount: 450000, status: 'unpaid' },
  ]
  return []
}
