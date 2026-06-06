import type { ProductStatus } from '@/shared/types'

type Tone = 'yellow' | 'blue' | 'green' | 'red' | 'gray' | 'purple'

// Yo'lovchi ko'radigan buyurtma holatlari (qisqa matn)
export const ORDER_STATUS: Record<ProductStatus, { text: string; tone: Tone }> = {
  pending_admin: { text: 'Admin tasdiqlashini kuting', tone: 'yellow' },
  confirmed: { text: 'Admin tasdiqladi, yukni kuting', tone: 'blue' },
  in_warehouse_uz: { text: 'Toshkent omborida', tone: 'gray' },
  with_carrier: { text: 'Mahsulot sizda', tone: 'green' },
  delivered_tr: { text: 'Yuk topshirildi', tone: 'green' },
  damaged: { text: 'Zarar yetgan', tone: 'red' },
}

// Ombor ko'rinishidagi holatlar (qisqaroq)
export const PRODUCT_STATUS: Record<ProductStatus, { text: string; tone: Tone }> = {
  pending_admin: { text: 'Tasdiq kutilmoqda', tone: 'yellow' },
  confirmed: { text: 'Tasdiqlangan', tone: 'blue' },
  in_warehouse_uz: { text: 'Toshkent omborida', tone: 'gray' },
  with_carrier: { text: 'Yo\'lovchida', tone: 'blue' },
  delivered_tr: { text: 'Yetib keldi', tone: 'green' },
  damaged: { text: 'Zarar yetgan', tone: 'red' },
}
