/**
 * TanStack Query hooks — barcha API so'rovlar uchun markazlashtirilgan
 * Re-use qilinishi uchun alohida faylda saqlanadi.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type {
  CatalogResponse,
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

// ─── Catalog ──────────────────────────────────────────────────────────────────

export function useCatalog() {
  return useQuery<CatalogResponse>({
    queryKey: ['catalog'],
    queryFn: async () => {
      const { data } = await api.get<CatalogResponse>('/catalog');
      return data;
    },
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

export function useAddToBasket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => {
      await api.post('/basket/add', { product_id: productId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['basket'] });
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
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
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
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

// ─── Profile ──────────────────────────────────────────────────────────────────

export function useUpdateLanguage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (language: string) => {
      await api.patch('/profile/me/language', { language });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
