export type Role =
  | 'new'
  | 'orderer'
  | 'warehouse_uz'
  | 'warehouse_tr'
  | 'china_worker'
  | 'carrier'
  | 'courier_uz'
  | 'courier_tr'
  | 'admin'
  | 'pending'

export interface User {
  id: number
  telegram_id: number
  first_name: string
  last_name: string
  phone: string
  role: Role
  carrier_number?: number // yo'lovchi tartib raqami
  is_active: boolean
}

export interface AuthState {
  token: string | null
  user: User | null
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

// Buyurtma holatlari (OrderStatus — backend enums.py bilan mos)
export type OrderStatus =
  | 'pending_admin'
  | 'confirmed'
  | 'in_warehouse_uz'
  | 'with_carrier'
  | 'delivered_tr'

// Yuk holatlari
export type ProductStatus =
  | 'pending_admin'       // Admin tasdiqlashini kutmoqda
  | 'confirmed'           // Admin tasdiqladi, yuk kutilmoqda
  | 'in_warehouse_uz'     // Toshkent omborida
  | 'with_courier_uz'     // Toshkent kuryerida
  | 'with_carrier'        // Yo'lovchida
  | 'delivered_tr'        // Turkiyaga topshirildi
  | 'damaged'             // Zarar yetgan

// Yuk turi: donali | kiloli (qutili) | tekstil. 'weight' — eski (textile bilan bir xil).
export type ProductType = 'piece' | 'boxed' | 'textile' | 'weight'

export interface Product {
  id: number
  barcode: string
  name: string
  category: string
  type: ProductType
  quantity: number          // jami dona (boxed: quti × 1 qutidagi soni)
  weight_kg: number         // jami kg
  unit_weight_kg?: number   // 1 dona vazni (donali) — limit hisoblash uchun
  box_weight_kg?: number    // 1 quti vazni (kiloli)
  box_count?: number        // quti soni (kiloli)
  units_per_box?: number    // 1 quti ichidagi soni (kiloli)
  cargo_price: number       // donali: $/dona; kiloli & tekstil: $/kg
  status: ProductStatus
  image_url?: string
  actual_quantity?: number  // ombor tortgandan keyingi haqiqiy dona
  actual_kg?: number        // ombor tortgandan keyingi haqiqiy kg
}

// Yo'lovchi bilet ma'lumotlari (har safar yangilanadi)
export interface Ticket {
  flight_date: string     // uchish sanasi
}

// Savatdagi element — tanlangan miqdor bilan
export interface CartItem {
  product: Product
  // donali bo'lsa: dona soni; kiloli bo'lsa: kg
  amount: number
  // hisoblangan og'irlik (limit uchun) va narx
  weight: number
  price: number
}

// Buyurtma ichidagi mahsulot detali (so'ralgan + tortilgan)
export interface CarrierOrderItem {
  product_id: number
  product_name: string
  type: ProductType
  amount: number            // so'ralgan dona/kg
  actual_quantity?: number  // ombor tortgan haqiqiy dona
  actual_kg?: number        // ombor tortgan haqiqiy kg (tekstil)
  confirmed: boolean
}

// Yo'lovchi buyurtmasi
export interface CarrierOrder {
  id: number
  carrier_id: number
  products: Product[]
  items?: CarrierOrderItem[]
  pickup_type: 'self' | 'courier'
  pickup_address?: string
  delivery_address_tr: string
  flight_date?: string
  status: OrderStatus
  created_at: string
}

// === Ombor: yo'lovchi buyurtmasi item detali ===
export interface OrderItemDetail {
  item_id: number           // order_item id (confirm uchun)
  product_id: number
  barcode: string
  product_name: string
  category: string
  type: ProductType
  requested_amount: number  // yo'lovchi so'ragan dona/kg
  actual_quantity?: number  // ombor kiritgan haqiqiy dona
  actual_kg?: number        // ombor tortgan haqiqiy kg (tekstil)
  confirmed: boolean
  cargo_price: number
}

// === Ombor: yo'lovchi buyurtmasi (admin tasdig'isiz) ===
export interface WarehouseOrder {
  order_id: number
  carrier_name: string
  carrier_number?: number
  pickup_type: 'self' | 'courier'
  pickup_address?: string
  delivery_address_tr: string
  status: ProductStatus
  created_at: string
  items: OrderItemDetail[]
  all_confirmed: boolean
}
