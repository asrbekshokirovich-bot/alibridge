import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '@/shared/api/client'
import { money } from '@/shared/lib/format'
import { isPiece, unitWord } from '@/shared/lib/product'
import { Header, ListSkeleton, EmptyState, StatusBadge, IconBox } from '@/shared/ui'
import type { Product } from '@/shared/types'

const STATUS_LABEL: Record<string, { label: string; tone: 'green' | 'yellow' | 'red' | 'gray' | 'blue' }> = {
  in_warehouse_uz: { label: 'Toshkent omborida', tone: 'blue' },
  pending_admin: { label: 'Tasdiq kutilmoqda', tone: 'yellow' },
  confirmed: { label: 'Tasdiqlangan', tone: 'green' },
  with_courier_uz: { label: 'Kuryerda', tone: 'yellow' },
  with_carrier: { label: 'Yo\'lovchida', tone: 'yellow' },
  delivered_tr: { label: 'Turkiyada', tone: 'green' },
  damaged: { label: 'Shikastlangan', tone: 'red' },
}

// Filtr: status guruhlari
const FILTERS: { key: string; label: string; match: (s: string) => boolean }[] = [
  { key: 'all', label: 'Barchasi', match: () => true },
  { key: 'warehouse', label: 'Omborda', match: (s) => s === 'in_warehouse_uz' },
  { key: 'moving', label: 'Yo\'lda', match: (s) => ['with_courier_uz', 'with_carrier', 'pending_admin', 'confirmed'].includes(s) },
  { key: 'delivered', label: 'Yetkazilgan', match: (s) => s === 'delivered_tr' },
  { key: 'damaged', label: 'Shikast', match: (s) => s === 'damaged' },
]

export default function AllProducts() {
  const [filter, setFilter] = useState('all')

  const { data, isLoading } = useQuery({
    queryKey: ['warehouse-uz-all-products'],
    queryFn: () => client.get<Product[]>('/warehouse-uz/all-products').then((r) => r.data),
  })

  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0]
  const filtered = data?.filter((p) => active.match(p.status))
  const count = (f: typeof FILTERS[number]) => data?.filter((p) => f.match(p.status)).length ?? 0

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title="Barcha yuklar" subtitle="Yuk harakatini kuzatish" showBack />

      {/* Status filtri */}
      <div className="px-4 pt-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          {FILTERS.map((f) => {
            const isActive = filter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`shrink-0 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all flex items-center gap-1.5 ${
                  isActive ? 'text-white shadow-sm' : 'bg-slate-100 text-slate-500'
                }`}
                style={isActive ? { background: 'var(--brand-gradient)' } : undefined}
              >
                {f.label}
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/25' : 'bg-white'}`}>{count(f)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : !filtered?.length ? (
        <EmptyState icon={<IconBox size={30} />} title="Yuk yo'q" description="Bu holatda yuk topilmadi" />
      ) : (
        <div className="px-4 pt-4 space-y-3 web-grid">
          {filtered.map((p) => {
            const st = STATUS_LABEL[p.status] ?? { label: p.status, tone: 'gray' as const }
            return (
              <div key={p.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                    <IconBox size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 truncate">{p.name}</p>
                    <p className="text-xs font-mono text-slate-400">{p.barcode}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <StatusBadge tone={st.tone} dot>{st.label}</StatusBadge>
                      <span className="text-xs text-slate-400">
                        {isPiece(p.type) ? `${p.quantity} dona` : `${p.weight_kg} kg · ${p.quantity} dona`}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900">{money(p.cargo_price)}</p>
                    <p className="text-[11px] text-slate-400">${p.cargo_price}/{unitWord(p.type)}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
