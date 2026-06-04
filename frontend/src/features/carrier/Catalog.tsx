import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, extractErrorMessage } from '@shared/api/client';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { EmptyState } from '@shared/components/EmptyState';
import { useBackButton, haptic } from '@shared/hooks/useTelegram';
import { useAuthStore } from '@shared/store/auth';

interface CatalogSpec {
  spec_id: string;
  title: string;
  category: string | null;
  photos: string[];
  available_count: number;
  basket_count: number;
  last_pick_id: string | null;
  min_weight_g: number;
  min_price: string;
  currency: string;
}

interface CatalogSpecsResponse {
  specs: CatalogSpec[];
  available_weight_g: number;
}

const ALL = 'Hammasi';

export default function CarrierCatalog({ readOnly = false }: { readOnly?: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isCarrier = !readOnly && useAuthStore((s) => s.hasRole('carrier'));

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(ALL);

  // Lokal tanlov — savatga o'tkazilgunicha serverga yuborilmaydi
  const [selection, setSelection] = useState<Record<string, number>>({});
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleBack = useCallback(() => navigate(-1), [navigate]);
  useBackButton(handleBack);

  const { data, isLoading, error } = useQuery<CatalogSpecsResponse>({
    queryKey: ['catalog-specs'],
    queryFn: async () => {
      const { data } = await api.get<CatalogSpecsResponse>('/catalog/specs');
      return data;
    },
    staleTime: 15_000,
  });

  const setQty = (specId: string, qty: number, max: number) => {
    haptic('light');
    setSelection((prev) => {
      const next = { ...prev };
      const clamped = Math.max(0, Math.min(qty, max));
      if (clamped <= 0) delete next[specId];
      else next[specId] = clamped;
      return next;
    });
  };

  const totalSelected = Object.values(selection).reduce((a, b) => a + b, 0);

  // Tanlovni savatga o'tkazish — har bir dona uchun add-by-spec
  const commitToCart = async () => {
    if (totalSelected === 0) return;
    setCommitting(true);
    setCommitError(null);
    setSuccessMsg(null);
    let added = 0;
    try {
      for (const [specId, qty] of Object.entries(selection)) {
        for (let i = 0; i < qty; i++) {
          await api.post('/basket/add-by-spec', { spec_id: specId });
          added += 1;
        }
      }
      haptic('success');
      setSelection({});
      setSuccessMsg(`✅ Savatga qo'shildi (${added} ta)`);
      window.setTimeout(() => setSuccessMsg(null), 2500);
    } catch (e) {
      haptic('error');
      setCommitError(
        added > 0
          ? `${added} ta qo'shildi. ${extractErrorMessage(e)}`
          : extractErrorMessage(e),
      );
    } finally {
      setCommitting(false);
      queryClient.invalidateQueries({ queryKey: ['catalog-specs'] });
      queryClient.invalidateQueries({ queryKey: ['basket'] });
    }
  };

  const categories = useMemo<string[]>(() => {
    if (!data?.specs.length) return [ALL];
    const cats = new Set(data.specs.map((s) => s.category || 'Boshqa'));
    return [ALL, ...Array.from(cats)];
  }, [data]);

  const filtered = useMemo<CatalogSpec[]>(() => {
    if (!data?.specs) return [];
    let list = data.specs;
    if (activeCategory !== ALL) {
      list = list.filter((s) => (s.category || 'Boshqa') === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((s) => s.title.toLowerCase().includes(q));
    }
    return list;
  }, [data, activeCategory, searchQuery]);

  if (isLoading) return <LoadingScreen />;

  if (error) {
    return (
      <div className="p-4">
        <EmptyState icon="⚠️" title="Xatolik" description={extractErrorMessage(error)} />
      </div>
    );
  }

  const availableKg = ((data?.available_weight_g ?? 0) / 1000).toFixed(1);
  const totalBasket = data?.specs.reduce((sum, s) => sum + s.basket_count, 0) ?? 0;

  return (
    <div className="flex flex-col bg-tg-bg min-h-screen">

      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-tg-bg pt-3 pb-1 shadow-sm">

        <div className="flex items-center justify-between px-4 mb-2">
          <h1 className="text-xl font-bold">📦 Mahsulotlar</h1>
          <div className="flex items-center gap-2">
            {isCarrier && totalBasket > 0 && (
              <button
                onClick={() => navigate('/carrier/basket')}
                className="bg-tg-button text-white text-xs font-semibold px-3 py-1 rounded-full active:opacity-70"
              >
                🛒 {totalBasket}
              </button>
            )}
            {isCarrier && data?.available_weight_g != null && data.available_weight_g > 0 && (
              <span className="bg-accent-blue/15 text-accent-blue text-xs font-semibold px-3 py-1 rounded-full">
                {availableKg} kg qoldi
              </span>
            )}
            {isCarrier && data?.available_weight_g === 0 && (
              <span className="bg-red-500/15 text-red-400 text-xs font-semibold px-3 py-1 rounded-full">
                Limit to'ldi
              </span>
            )}
          </div>
        </div>

        {successMsg && (
          <div className="mx-4 mb-2 bg-emerald-500/15 text-emerald-400 text-sm font-semibold p-2 rounded-xl text-center">
            {successMsg}
          </div>
        )}

        <div className="relative px-4 mb-2">
          <span className="absolute left-7 top-1/2 -translate-y-1/2 text-tg-hint text-sm pointer-events-none">🔍</span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Mahsulot qidirish..."
            className="w-full bg-tg-secondaryBg rounded-xl pl-9 pr-8 py-2 text-sm outline-none placeholder-tg-hint"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-7 top-1/2 -translate-y-1/2 text-tg-hint text-xl leading-none"
            >×</button>
          )}
        </div>

        {categories.length > 1 && (
          <div className="flex gap-2 px-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); haptic('light'); }}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  activeCategory === cat ? 'bg-tg-button text-white' : 'bg-tg-secondaryBg text-tg-text'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-1">
        <p className="text-xs text-tg-hint">
          {filtered.length} ta mahsulot turi
        </p>
      </div>

      <div className="px-3 pb-28">
        {filtered.length === 0 ? (
          <div className="mt-16">
            <EmptyState
              icon={searchQuery ? '🔍' : '📦'}
              title={
                searchQuery
                  ? 'Topilmadi'
                  : activeCategory !== ALL
                  ? `${activeCategory} da mahsulot yo'q`
                  : "Hozircha mahsulot yo'q"
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((spec) => {
              const soldOut = spec.available_count === 0;
              const price = parseFloat(spec.min_price);
              const photo = spec.photos[0] ?? null;
              const selected = selection[spec.spec_id] ?? 0;

              return (
                <div
                  key={spec.spec_id}
                  className="bg-tg-secondaryBg rounded-2xl overflow-hidden flex flex-col"
                >
                  <div className="w-full aspect-square bg-white/5 flex items-center justify-center overflow-hidden relative">
                    {photo ? (
                      <img src={photo} alt={spec.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-5xl">📦</span>
                    )}
                    {selected > 0 && (
                      <span className="absolute top-2 right-2 bg-tg-button text-white text-xs font-bold min-w-[22px] h-[22px] px-1 rounded-full flex items-center justify-center shadow">
                        {selected}
                      </span>
                    )}
                    {isCarrier && spec.basket_count > 0 && (
                      <span className="absolute top-2 left-2 bg-white/90 text-tg-button text-[10px] font-semibold px-1.5 py-0.5 rounded-full shadow">
                        🛒 {spec.basket_count}
                      </span>
                    )}
                    {soldOut && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="text-white text-xs font-semibold bg-black/60 px-2 py-0.5 rounded-md">Tugadi</span>
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 flex flex-col flex-1">
                    <p className="font-semibold text-sm leading-tight line-clamp-2">{spec.title}</p>
                    <p className="text-xs text-tg-hint mt-0.5">{spec.available_count} ta mavjud</p>
                    <p className="text-sm font-bold text-tg-button mt-1">
                      {price > 0 ? `${+price.toFixed(2)} ${spec.currency}` : '—'}
                    </p>

                    {isCarrier && !soldOut && (
                      <div className="mt-2">
                        {selected === 0 ? (
                          <button
                            onClick={() => setQty(spec.spec_id, 1, spec.available_count)}
                            className="w-full bg-tg-button text-white text-xs font-semibold py-2 rounded-xl active:opacity-70"
                          >
                            + Tanlash
                          </button>
                        ) : (
                          <div className="flex items-center justify-between gap-1">
                            <button
                              onClick={() => setQty(spec.spec_id, selected - 1, spec.available_count)}
                              className="flex-1 h-8 rounded-xl bg-red-500/20 text-red-400 text-xl font-bold flex items-center justify-center active:opacity-70"
                            >−</button>
                            <span className="text-sm font-bold w-6 text-center">{selected}</span>
                            <button
                              onClick={() => setQty(spec.spec_id, selected + 1, spec.available_count)}
                              disabled={selected >= spec.available_count}
                              className="flex-1 h-8 rounded-xl bg-tg-button text-white text-xl font-bold flex items-center justify-center active:opacity-70 disabled:opacity-50"
                            >+</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pastdagi "Savatga o'tkazish" tugmasi — tanlov bo'lsa chiqadi */}
      {isCarrier && totalSelected > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-tg-bg/95 backdrop-blur border-t border-white/10 p-4 space-y-2 z-20">
          {commitError && (
            <p className="rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-400 text-center">
              {commitError}
            </p>
          )}
          <button
            onClick={commitToCart}
            disabled={committing}
            className="w-full bg-tg-button text-white text-base font-semibold py-3 rounded-xl active:opacity-70 disabled:opacity-50"
          >
            {committing ? '⏳ Qo\'shilmoqda...' : `🛒 Savatga o'tkazish (${totalSelected} ta)`}
          </button>
        </div>
      )}
    </div>
  );
}
