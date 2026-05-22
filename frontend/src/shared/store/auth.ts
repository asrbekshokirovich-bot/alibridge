/**
 * Auth store — JWT token, user, roles.
 *
 * Telegram initData orqali login.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@shared/api/client';
import { getInitData } from '@shared/utils/telegram';

export type Role =
  | 'orderer'
  | 'china_worker'
  | 'warehouse_uz'
  | 'warehouse_tr'
  | 'carrier'
  | 'courier_uz'
  | 'courier_tr'
  | 'admin';

interface User {
  id: string;
  roles: Role[];
  languageCode: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => void;
  hasRole: (role: Role) => boolean;
  hasAnyRole: (roles: Role[]) => boolean;
}

interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user_id: string;
  roles: string[];
  language_code: string;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async () => {
        set({ isLoading: true });
        try {
          const initData = getInitData();
          if (!initData) {
            throw new Error('Telegram initData yo\'q');
          }

          const { data } = await api.post<AuthResponse>('/auth/telegram', {
            init_data: initData,
          });

          set({
            token: data.access_token,
            user: {
              id: data.user_id,
              roles: data.roles as Role[],
              languageCode: data.language_code,
            },
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
        });
      },

      hasRole: (role: Role) => {
        return get().user?.roles.includes(role) ?? false;
      },

      hasAnyRole: (roles: Role[]) => {
        const userRoles = get().user?.roles ?? [];
        return roles.some((r) => userRoles.includes(r));
      },
    }),
    {
      name: 'alibridge-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
      // Sahifa qayta yuklanganida token + user mavjud bo'lsa, isAuthenticated=true
      onRehydrateStorage: () => (state) => {
        if (state?.token && state?.user) {
          state.isAuthenticated = true;
        }
      },
    },
  ),
);
