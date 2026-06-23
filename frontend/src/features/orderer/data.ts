import type { TimelineStep } from '@/shared/ui'

/* ════════════════════════════════════════════════════════════════════════
   ⚠️  TODO(backend): Buyurtmachi (orderer) uchun API endpointlari HALI YO'Q.
   Backendda (backend/app/api/v1/endpoints/) orderer moduli mavjud emas.
   Quyidagi endpointlar kerak bo'ladi — ular paydo bo'lganda useQuery bilan
   ulansin (hozircha UI quyidagi MOCK ma'lumot bilan ishlaydi):

     GET  /orderer/orders
          -> Buyurtmalar ro'yxati: [{ id, name, price, currency, status,
                                       route_progress, image_url }]
     GET  /orderer/orders/{id}/track
          -> Kuzatuv: { product, price, barcode, timeline[], delivery_code }

   Auth (login + select-role 'orderer') ALLAQACHON ishlaydi — RoleGuard o'tadi.
   ════════════════════════════════════════════════════════════════════════ */

export type OrderStatusKey = 'buying' | 'warehouse_uz' | 'with_carrier' | 'warehouse_tr' | 'delivered'

export interface OrdererOrder {
  id: string
  name: string
  price: number
  /** 0..1 — TAS→IST yo'lining bosib o'tilgan ulushi */
  routeProgress: number
  status: OrderStatusKey
  flight?: string
  barcode?: string
  /** lime "Yetkazib berish kodi" (faqat yetkazishga tayyor/yetkazilganda) */
  deliveryCode?: string
}

// ── MOCK ma'lumot (placeholder) — backend tayyor bo'lganda olib tashlanadi ──
export const MOCK_ORDERS: OrdererOrder[] = [
  {
    id: 'AB-7K2M',
    name: "Krasovka Nike Air",
    price: 480000,
    routeProgress: 0.52,
    status: 'with_carrier',
    flight: 'HY601 · 26-iyun',
    barcode: 'AB-7K2M-0420',
    deliveryCode: '4827',
  },
  {
    id: 'AB-9P4X',
    name: 'Parfyum Dior Sauvage',
    price: 320000,
    routeProgress: 0.18,
    status: 'warehouse_uz',
    barcode: 'AB-9P4X-0418',
  },
  {
    id: 'AB-3L1Q',
    name: "Ko'ylak Zara",
    price: 145000,
    routeProgress: 1,
    status: 'delivered',
    barcode: 'AB-3L1Q-0412',
    deliveryCode: '1903',
  },
  {
    id: 'AB-6T8R',
    name: 'AirPods Pro 2',
    price: 390000,
    routeProgress: 0,
    status: 'buying',
  },
]

// Status → ko'rsatiladigan matn kaliti + pill tone (t() bilan ekranlarda tarjima qilinadi)
export const ORDER_STATUS_META: Record<OrderStatusKey, { key: string; tone: 'purple' | 'blue' | 'red' | 'green' }> = {
  buying:       { key: 'Xaridda', tone: 'purple' },
  warehouse_uz: { key: 'Toshkent omborida', tone: 'blue' },
  with_carrier: { key: "Yo'lovchida", tone: 'red' },
  warehouse_tr: { key: 'Turkiya omborida', tone: 'blue' },
  delivered:    { key: 'Yetkazildi', tone: 'green' },
}

// Buyurtma uchun kuzatuv timeline'i (status'ga qarab done/active/pending).
// tr() — chaqiruvchi ekrandan keladigan tarjima funksiyasi.
export function buildTimeline(order: OrdererOrder, tr: (k: string) => string): TimelineStep[] {
  const order_idx: OrderStatusKey[] = ['buying', 'warehouse_uz', 'with_carrier', 'warehouse_tr', 'delivered']
  const cur = order_idx.indexOf(order.status)
  const st = (i: number): TimelineStep['state'] => (i < cur ? 'done' : i === cur ? 'active' : 'pending')
  return [
    { title: tr('Xitoyda sotib olindi'), state: st(0), meta: st(0) === 'done' ? tr('Bajarildi') : undefined },
    { title: tr('Toshkent omborida qabul qilindi'), state: st(1), barcode: order.barcode, meta: st(1) === 'done' ? tr('Bajarildi') : undefined },
    { title: tr("Yo'lovchida"), state: st(2), meta: st(2) === 'active' ? tr('Hozir') : undefined, flight: order.flight ? `${tr('Reys')} ${order.flight}` : undefined },
    { title: tr('Turkiya omborida'), state: st(3), meta: st(3) === 'active' ? tr('Hozir') : undefined },
    { title: tr('Sizga yetkazildi'), state: st(4), meta: st(4) === 'active' ? tr('Hozir') : undefined },
  ]
}

// Narxni so'm ko'rinishida (mock — orderer reference so'mda)
export function som(n: number): string {
  return n.toLocaleString('ru-RU').replace(/ /g, ' ') + " so'm"
}
