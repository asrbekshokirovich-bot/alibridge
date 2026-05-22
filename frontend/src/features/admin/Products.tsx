/**
 * Admin — Mahsulotlar sahifasi
 *
 * Warehouse_uz worker QuickIntake orqali kiritgan mahsulotlarni ko'rsatadi.
 * Qidiruv (short_code / nomi) + status filtri + load more.
 */
import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { EmptyState } from '@shared/components/EmptyState';
import { useBackButton } from '@shared/hooks/useTelegram';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProductItem {
  id: string;
  short_code: string;
  spec_title: string;
  unit_weight_g: number;
  status: string;
  color: string | null;
  condition: string;
  created_at: string;
  label_printed: boolean;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: '',                 labelKey: 'admin.all_statuses' },
  { key: 'at_tashkent_wh',  labelKey: 'status.at_tashkent_wh' },
  { key: 'with_courier_uz', labelKey: 'status.with_courier_uz' },
  { key: 'with_carrier',    labelKey: 'status.with_carrier' },
  { key: 'at_tr_wh',        labelKey: 'status.at_tr_wh' },
  { key: 'delivered',       labelKey: 'status.delivered' },
];

const STATUS_COLORS: Record<string, string> = {
  pending_intake:   'bg-yellow-100 text-yellow-800',
  at_tashkent_wh:   'bg-blue-100 text-blue-800',
  in_basket:        'bg-orange-100 text-orange-800',
  with_courier_uz:  'bg-purple-100 text-purple-800',
  with_carrier:     'bg-indigo-100 text-indigo-800',
  in_flight:        'bg-sky-100 text-sky-800',
  with_courier_tr:  'bg-violet-100 text-violet-800',
  at_tr_wh:         'bg-teal-100 text-teal-800',
  delivered:        'bg-green-100 text-green-800',
  lost:             'bg-red-100 text-red-800',
  cancelled:        'bg-gray-100 text-gray-500',
};

const PAGE_SIZE = 30;

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminProducts() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState('');
  // Debounced search so API so'rovlar kamaytirish
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useBackButton(() => navigate(-1));

  // Search debounce
  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((handleSearch as unknown as { _t?: ReturnType<typeof setTimeout> })._t);
    const timer = setTimeout(() => setDebouncedSearch(val), 400);
    (handleSearch as unknown as { _t?: ReturnType<typeof setTimeout> })._t = timer;
  };

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery<ProductItem[]>({
      queryKey: ['admin-products', debouncedSearch, activeStatus],
      queryFn: async ({ pageParam = 0 }) => {
        const params = new URLSearchParams({
          q: debouncedSearch,
          status: activeStatus,
          skip: String(pageParam),
          limit: String(PAGE_SIZE),
        });
        const { data } = await api.get<ProductItem[]>(`/admin/products?${params}`);
        return data;
      },
      getNextPageParam: (lastPage, allPages) =>
        lastPage.length === PAGE_SIZE ? allPages.flat().length : undefined,
      initialPageParam: 0,
    });

  const products = data?.pages.flat() ?? [];

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="space-y-3 p-4 pb-24">
      {/* Sarlavha */}
      <h2 className="px-1 text-lg font-bold">{t('admin.products')}</h2>

      {/* Qidiruv */}
      <input
        type="text"
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder={t('admin.search_products')}
        className="w-full rounded-xl border border-tg-secondary-bg bg-tg-secondary-bg
                   px-4 py-2.5 text-sm outline-none focus:border-tg-button"
      />

      {/* Status filtri (gorizontal scroll) */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveStatus(tab.key)}
            className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-all
              ${activeStatus === tab.key
                ? 'bg-tg-button text-tg-button-text'
                : 'bg-tg-secondary-bg text-tg-hint'
              }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Mahsulotlar soni */}
      {products.length > 0 && (
        <p className="px-1 text-xs text-tg-hint">
          {products.length} ta mahsulot
        </p>
      )}

      {/* Bo'sh holat */}
      {!isLoading && products.length === 0 && (
        <EmptyState icon="📦" title={t('admin.no_products')} />
      )}

      {/* Mahsulotlar ro'yxati */}
      {products.map((product) => (
        <Card key={product.id} className="py-2.5">
          <div className="flex items-start justify-between gap-2">
            {/* Chap tomon */}
            <div className="min-w-0 flex-1">
              {/* Nomi */}
              <p className="truncate font-semibold">{product.spec_title}</p>

              {/* short_code + og'irlik */}
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <span className="rounded bg-tg-secondary-bg px-1.5 py-0.5 font-mono text-xs">
                  {product.short_code}
                </span>
                <span className="text-xs text-tg-hint">
                  ⚖️ {(product.unit_weight_g / 1000).toFixed(2)} kg
                </span>
                {product.color && (
                  <span className="text-xs text-tg-hint">🎨 {product.color}</span>
                )}
              </div>

              {/* Sana */}
              <p className="mt-0.5 text-xs text-tg-hint">
                {new Date(product.created_at).toLocaleDateString('uz-UZ', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                })}
              </p>
            </div>

            {/* O'ng tomon — status badge */}
            <div className="flex flex-col items-end gap-1">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold
                  ${STATUS_COLORS[product.status] ?? 'bg-gray-100 text-gray-600'}`}
              >
                {t(`status.${product.status}`, { defaultValue: product.status })}
              </span>
              {product.label_printed ? (
                <span className="text-xs text-green-600">🏷️ chop etilgan</span>
              ) : (
                <span className="text-xs text-tg-hint">🏷️ chop etilmagan</span>
              )}
            </div>
          </div>
        </Card>
      ))}

      {/* Ko'proq yuklash */}
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="w-full rounded-xl bg-tg-secondary-bg py-3 text-sm font-medium
                     text-tg-hint transition-all active:scale-95 disabled:opacity-50"
        >
          {isFetchingNextPage ? '...' : '⬇️ Ko\'proq yuklash'}
        </button>
      )}
    </div>
  );
}
