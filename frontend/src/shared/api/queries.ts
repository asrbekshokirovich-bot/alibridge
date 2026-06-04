/**
 * TanStack Query hooks — barcha API so'rovlar uchun markazlashtirilgan
 * Re-use qilinishi uchun alohida faylda saqlanadi.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type {
  BasketPick,
  OrderSummary,
  OrderDetail,
  PayoutRequest,
  Dispute,
  UserProfile,
  ScanRequest,
  ScanResponse,
} from '@shared/types/api';

// ─── Auth ────────────────────────────────────────────────────────────────────

interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user_id: string;
  roles: string[];
  language_code: string;
}

/** Yangi foydalanuvchi o'zi uchun rol tanlaydi ('orderer' | 'carrier') */
export function useSelectRole() {
  return useMutation<AuthResponse, Error, 'orderer' | 'carrier'>({
    mutationFn: async (role) => {
      const { data } = await api.post<AuthResponse>('/auth/select-role', { role });
      return data;
    },
  });
}

export function useMe() {
  return useQuery<UserProfile>({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await api.get<UserProfile>('/profile/me');
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 daqiqa
  });
}

// ─── Basket ───────────────────────────────────────────────────────────────────

export function useBasket() {
  return useQuery<BasketPick[]>({
    queryKey: ['basket'],
    queryFn: async () => {
      const { data } = await api.get<BasketPick[]>('/basket');
      return data;
    },
  });
}

export function useRemoveFromBasket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pickId: string) => {
      await api.delete(`/basket/${pickId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['basket'] });
      queryClient.invalidateQueries({ queryKey: ['catalog-specs'] });
    },
  });
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export function useOrders() {
  return useQuery<OrderSummary[]>({
    queryKey: ['orders'],
    queryFn: async () => {
      const { data } = await api.get<OrderSummary[]>('/orders');
      return data;
    },
  });
}

export function useOrder(orderId: string | undefined) {
  return useQuery<OrderDetail>({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const { data } = await api.get<OrderDetail>(`/orders/${orderId}`);
      return data;
    },
    enabled: !!orderId,
  });
}

// ─── Carrier picks ────────────────────────────────────────────────────────────

export function useCarrierPicks() {
  return useQuery({
    queryKey: ['carrier-picks'],
    queryFn: async () => {
      const { data } = await api.get('/carrier/picks');
      return data;
    },
  });
}

// ─── Scan ─────────────────────────────────────────────────────────────────────

export function useScan() {
  return useMutation<ScanResponse, Error, ScanRequest>({
    mutationFn: async (payload) => {
      const { data } = await api.post<ScanResponse>('/scan', payload);
      return data;
    },
  });
}

// ─── Payouts ──────────────────────────────────────────────────────────────────

export function usePayouts() {
  return useQuery<PayoutRequest[]>({
    queryKey: ['payouts'],
    queryFn: async () => {
      const { data } = await api.get<PayoutRequest[]>('/payouts');
      return data;
    },
  });
}

export function useRequestPayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      payout_method: string;
      account_details: string;
      pick_ids: string[];
    }) => {
      const { data } = await api.post('/payouts/request', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payouts'] });
      queryClient.invalidateQueries({ queryKey: ['carrier-picks'] });
    },
  });
}

// ─── Disputes ─────────────────────────────────────────────────────────────────

export function useDisputes(status?: string) {
  return useQuery<Dispute[]>({
    queryKey: ['disputes', status],
    queryFn: async () => {
      const url = status ? `/disputes?status=${status}` : '/disputes';
      const { data } = await api.get<Dispute[]>(url);
      return data;
    },
  });
}

// ─── Products ─────────────────────────────────────────────────────────────────

/** Admin: mahsulotni o'chirish */
export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => {
      await api.delete(`/admin/products/${productId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
  });
}

/** Warehouse UZ: mahsulotni o'chirish */
export function useDeleteProductWh() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => {
      await api.delete(`/warehouse/uz/products/${productId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-intake-labels'] });
    },
  });
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export function useUpdateLanguage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (language: string) => {
      await api.patch('/profile/me/language', { language_code: language });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

// ─── China sourcing ─────────────────────────────────────────────────────────

export interface ChinaTicket {
  order_line_id: string;
  sourcing_spec_id: string;
  title: string;
  description: string | null;
  category: string | null;
  photos: string[];
  quantity: number;
  target_unit_weight_g: number | null;
  color: string | null;
  notes: string | null;
}

export interface ChinaShipmentItem {
  id: string;
  short_code: string;
  status: string;
  unit_weight_g: number;
  color: string | null;
  title: string;
  photo: string | null;
}

export interface ChinaStats {
  open_tickets: number;
  ready_to_ship: number;
  in_transit: number;
}

export function useChinaStats() {
  return useQuery<ChinaStats>({
    queryKey: ['china-stats'],
    queryFn: async () => {
      const { data } = await api.get<ChinaStats>('/china/stats');
      return data;
    },
  });
}

export function useChinaTickets() {
  return useQuery<ChinaTicket[]>({
    queryKey: ['china-tickets'],
    queryFn: async () => {
      const { data } = await api.get<ChinaTicket[]>('/china/tickets');
      return data;
    },
  });
}

export function useChinaShipments() {
  return useQuery<ChinaShipmentItem[]>({
    queryKey: ['china-shipments'],
    queryFn: async () => {
      const { data } = await api.get<ChinaShipmentItem[]>('/china/shipments');
      return data;
    },
  });
}

export function useSourceTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      order_line_id: string;
      count: number;
      unit_weight_g: number;
      color?: string | null;
      box_items_count?: number | null;
    }) => {
      const { order_line_id, ...body } = payload;
      const { data } = await api.post(`/china/tickets/${order_line_id}/source`, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['china-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['china-shipments'] });
      queryClient.invalidateQueries({ queryKey: ['china-stats'] });
    },
  });
}

export function useShipProducts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (productIds: string[]) => {
      const { data } = await api.post('/china/shipments/ship', { product_ids: productIds });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['china-shipments'] });
      queryClient.invalidateQueries({ queryKey: ['china-stats'] });
    },
  });
}
