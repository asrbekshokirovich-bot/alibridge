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
  username?: string | null // sayt (brauzer) login
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

// O'lcham varianti — bir mahsulot ichida (39, 40, M, L...)
export interface ProductVariant {
  id: number
  size_label: string        // "39", "M"... (bo'sh = variantsiz eski mahsulot)
  quantity: number
  weight_kg: number         // jami kg (tara bilan)
  tare_kg?: number
  unit_weight_kg?: number   // 1 dona vazni — limit hisoblash uchun
  box_weight_kg?: number
  box_count?: number
  units_per_box?: number
  cargo_price: number       // donali: $/dona; kiloli & tekstil: $/kg
  position: number
}

export interface Product {
  id: number
  barcode: string
  name: string
  category: string
  type: ProductType
  quantity: number          // jami dona (variantlar yig'indisi)
  weight_kg: number         // jami kg (variantlar yig'indisi)
  tare_kg?: number          // qadoq/quti vazni (kg). Sof vazn = weight_kg − tare_kg
  unit_weight_kg?: number   // 1 dona vazni (donali) — limit hisoblash uchun
  box_weight_kg?: number    // 1 quti vazni (kiloli)
  box_count?: number        // quti soni (kiloli)
  units_per_box?: number    // 1 quti ichidagi soni (kiloli)
  cargo_price: number       // donali: $/dona; kiloli & tekstil: $/kg
  status: ProductStatus
  image_url?: string
  actual_quantity?: number  // ombor tortgandan keyingi haqiqiy dona
  actual_kg?: number        // ombor tortgandan keyingi haqiqiy kg
  in_warehouse_qty?: number // Toshkent omborida hozir qolgan jami (0 = qolmadi)
  variants: ProductVariant[]
}

// Yo'lovchi bilet ma'lumotlari (har safar yangilanadi)
export interface Ticket {
  flight_date: string     // uchish sanasi
  flight_number?: string  // reys raqami (masalan HY601)
}

// Savatdagi element — tanlangan o'lcham (variant) va miqdor bilan
export interface CartItem {
  product: Product
  variant: ProductVariant   // qaysi o'lcham tanlandi
  // donali bo'lsa: dona soni; kiloli bo'lsa: kg
  amount: number
  // hisoblangan og'irlik (limit uchun) va narx
  weight: number
  price: number
}

// Buyurtma ichidagi mahsulot detali (so'ralgan + tortilgan)
export interface CarrierOrderItem {
  product_id: number
  variant_id?: number
  size_label?: string
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
  flight_number?: string
  status: OrderStatus
  created_at: string
}

// Yo'lovchi hozir o'zida olib yurgan yuk (kuryer aeroportда topshirgan)
export interface CarrierMyProduct {
  product_id: number
  barcode: string
  product_name: string
  category: string
  image_url?: string | null
  size_label: string
  quantity: number
  received_at: string
}

// === Ombor: yo'lovchi buyurtmasi item detali ===
export interface OrderItemDetail {
  item_id: number           // order_item id (confirm uchun)
  product_id: number
  variant_id?: number
  size_label?: string
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
