/**
 * API DTO type'lari — backend bilan mos kelishi shart.
 * DEV_PLAN §4 da keltirilgan jadvallar asosida.
 */

// ─── Auth ────────────────────────────────────────────────────────────────────

export type Role =
  | 'orderer'
  | 'carrier'
  | 'warehouse_uz'
  | 'warehouse_tr'
  | 'china_worker'
  | 'courier_uz'
  | 'courier_tr'
  | 'admin';

export type Language = 'uz' | 'ru' | 'tr' | 'en';

export interface AuthResponse {
  access_token: string;
  token_type: 'bearer';
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  telegram_id: string;
  full_name: string;
  username: string | null;
  language: Language;
  roles: Role[];
  created_at: string;
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'IN_PRODUCTION'
  | 'READY_TO_SHIP'
  | 'IN_TRANSIT'
  | 'CUSTOMS'
  | 'DELIVERED'
  | 'CANCELLED';

export type OrderSource = 'SELF' | 'WALK_IN';

export interface OrderSummary {
  id: string;
  order_number: string;
  status: OrderStatus;
  source: OrderSource;
  destination_city: string;
  total_items: number;
  created_at: string;
}

export interface OrderLine {
  id: string;
  spec_title: string;
  quantity: number;
  count_received: number;
  unit_weight_g: number;
}

export interface OrderDetail extends OrderSummary {
  lines: OrderLine[];
  products: ProductTrack[];
  notes: string | null;
}

// ─── Products ─────────────────────────────────────────────────────────────────

export type ProductStatus =
  | 'SOURCING'
  | 'READY_AT_CHINA'
  | 'WITH_CARRIER'
  | 'ARRIVED_UZ'
  | 'IN_TRANSIT_TO_TR'
  | 'ARRIVED_TR'
  | 'WITH_COURIER'
  | 'DELIVERED'
  | 'DISPUTED'
  | 'LOST';

export interface ProductTrack {
  id: string;
  short_code: string;
  spec_title: string;
  status: ProductStatus;
  custody_events: CustodyEvent[];
}

// ─── Custody ──────────────────────────────────────────────────────────────────

export type HolderType =
  | 'CHINA_WORKER'
  | 'CARRIER'
  | 'WAREHOUSE_UZ'
  | 'WAREHOUSE_TR'
  | 'COURIER_UZ'
  | 'COURIER_TR'
  | 'ORDERER';

export type CustodyEventType =
  | 'CREATED'
  | 'PICKED_BY_CARRIER'
  | 'ARRIVED_UZ'
  | 'DISPATCHED_FROM_UZ'
  | 'ARRIVED_TR'
  | 'DISPATCHED_FROM_TR'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'DISPUTED';

export interface CustodyEvent {
  id: string;
  event_type: CustodyEventType;
  holder_type: HolderType;
  created_at: string;
  location?: string;
  actor_name?: string;
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

export interface CatalogItem {
  id: string;
  short_code: string;
  spec_title: string;
  spec_photos: string[];
  unit_weight_g: number;
  color: string | null;
  cargo_price: string;
  cargo_currency: string;
  value_tier: 'ECONOMY' | 'STANDARD' | 'LUXURY';
}

export interface CatalogResponse {
  items: CatalogItem[];
  total: number;
  available_weight_g: number;
}

// ─── Basket ───────────────────────────────────────────────────────────────────

export interface BasketPick {
  id: string;
  product_id: string;
  short_code: string;
  spec_title: string;
  locked_cargo_price: string;
  locked_currency: string;
  locked_weight_g: number;
  basket_lock_until: string | null;
}

// ─── Payouts ──────────────────────────────────────────────────────────────────

export type PayoutStatus = 'REQUESTED' | 'APPROVED' | 'PAID' | 'REJECTED';
export type PayoutMethod = 'CARD_UZ' | 'CARD_TR' | 'CRYPTO_USDT' | 'CASH';

export interface PayoutRequest {
  id: string;
  payout_method: PayoutMethod;
  gross_amount: string;
  deductions: string;
  net_amount: string;
  currency: string;
  status: PayoutStatus;
  requested_at: string;
  paid_at: string | null;
}

// ─── Carrier ──────────────────────────────────────────────────────────────────

export type TrustTier = 'NEW' | 'TRUSTED' | 'VERIFIED' | 'VIP';

export interface CarrierProfile {
  id: string;
  user_id: string;
  trust_tier: TrustTier;
  kg_limit: number;
  total_trips: number;
  total_delivered: number;
  liability_consented_at: string;
}

// ─── Scan ─────────────────────────────────────────────────────────────────────

export interface ScanRequest {
  qr_payload: string;
  context?: string;
}

export interface ScanResponse {
  product_id: string;
  short_code: string;
  prev_holder_type: HolderType;
  new_holder_type: HolderType;
  event_id: string;
}

// ─── Disputes ─────────────────────────────────────────────────────────────────

export type DisputeType = 'MISSING' | 'DAMAGED' | 'WRONG_ITEM' | 'CUSTOMS_SEIZED';
export type DisputeStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED';
export type DisputeResolution =
  | 'CARRIER_FAULT'
  | 'FORCE_MAJEURE'
  | 'ORDERER_FAULT'
  | 'SPLIT';

export interface Dispute {
  id: string;
  dispute_type: DisputeType;
  status: DisputeStatus;
  product_short_code: string;
  carrier_name: string;
  filed_by_name: string;
  filed_at: string;
  description: string;
  resolution: DisputeResolution | null;
  resolved_at: string | null;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}

// ─── Error ────────────────────────────────────────────────────────────────────

export interface ApiError {
  detail: string | { msg: string; type: string }[];
  code?: string;
}
