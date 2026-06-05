export type Role =
  | 'orderer'
  | 'warehouse_uz'
  | 'warehouse_tr'
  | 'china_worker'
  | 'carrier'
  | 'courier_uz'
  | 'courier_tr'
  | 'admin'

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

// Yuk holatlari
export type ProductStatus =
  | 'pending_admin'       // Admin tasdiqlashini kutmoqda
  | 'confirmed'           // Admin tasdiqladi, yuk kutilmoqda
  | 'in_warehouse_uz'     // Toshkent omborida
  | 'with_carrier'        // Yo'lovchida
  | 'delivered_tr'        // Turkiyaga topshirildi
  | 'damaged'             // Zarar yetgan

// Yuk turi
export type ProductType = 'piece' | 'weight' // donali | kiloli

export interface Product {
  id: number
  barcode: string
  name: string
  category: string
  type: ProductType
  quantity: number          // mavjud jami soni (donali) / jami dona (kiloli)
  weight_kg: number         // mavjud jami kg
  unit_weight_kg?: number   // 1 dona vazni (donali uchun) — limit hisoblash uchun
  box_weight_kg?: number    // kartonka vazni (faqat tekstil)
  cargo_price: number       // donali: 1 dona narxi / kiloli: 1 kg narxi
  status: ProductStatus
  image_url?: string
}

// Yo'lovchi bilet ma'lumotlari (har safar yangilanadi)
export interface Ticket {
  flight_number: string   // reys raqami
  flight_date: string     // uchish sanasi
  weight_limit: number    // kg limiti
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

// Yo'lovchi buyurtmasi
export interface CarrierOrder {
  id: number
  carrier_id: number
  products: Product[]
  pickup_type: 'self' | 'courier'
  pickup_address?: string
  delivery_address_tr: string
  status: ProductStatus
  created_at: string
}
