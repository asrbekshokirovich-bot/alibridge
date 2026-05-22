/**
 * Basket store — carrier korzinasi.
 *
 * Optimistic updates bilan ishlaydi:
 * 1. UI darhol yangilanadi
 * 2. Server'ga so'rov yuboriladi
 * 3. Xato bo'lsa rollback
 */

import { create } from 'zustand';

export interface BasketItem {
  pickId: string;
  productId: string;
  shortCode: string;
  title: string;
  weightG: number;
  cargoPrice: string;
  cargoCurrency: string;
  basketLockUntil: string | null;
}

interface BasketState {
  items: BasketItem[];
  isLoading: boolean;
  setItems: (items: BasketItem[]) => void;
  addItem: (item: BasketItem) => void;
  removeItem: (pickId: string) => void;
  clear: () => void;
  getTotalWeight: () => number;
}

export const useBasketStore = create<BasketState>((set, get) => ({
  items: [],
  isLoading: false,

  setItems: (items) => set({ items }),

  addItem: (item) => set((state) => ({ items: [...state.items, item] })),

  removeItem: (pickId) =>
    set((state) => ({ items: state.items.filter((i) => i.pickId !== pickId) })),

  clear: () => set({ items: [] }),

  getTotalWeight: () => {
    return get().items.reduce((sum, item) => sum + item.weightG, 0);
  },
}));
