/// <reference types="vite/client" />
/**
 * API client — barcha backend chaqiruvlari.
 *
 * - Axios instance
 * - JWT token avtomatik header'ga qo'shiladi
 * - Xato handling
 */

import axios, { AxiosError, AxiosInstance } from 'axios';
import { useAuthStore } from '@shared/store/auth';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================
// Request interceptor — JWT qo'shish
// ============================================
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ============================================
// Response interceptor — xato handling
// ============================================
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    // 401 — token expired
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }

    return Promise.reject(error);
  },
);

// ============================================
// API error tipi
// ============================================
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data as ApiError | undefined;
    if (apiError?.error?.message) {
      return apiError.error.message;
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Noma\'lum xato';
}
