import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import client from '@/shared/api/client'
import type { Product } from '@/shared/types'
import { PRODUCT_STATUS } from '@/shared/lib/status'
import { productGroup, typeEmoji, labelUrl, type ProductGroup } from '@/shared/lib/product'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { Header, ListSkeleton, EmptyState, StatusBadge, IconBox } from '@/shared/ui'

type Filter = 'all' | ProductGroup

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Umumiy' },
  { key: 'piece', label: 'Donali' },
  { key: 'boxed', label: 'Kiloli' },
  { key: 'textile', label: 'Tekstil' },
]

const CHIP = 'text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg'
const CHIP_MUTED = 'text-xs font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg'

export default function Products() {
  const navigate = useNavigate()
  const { openLink } = useTelegram()
  const [filter, setFilter] = useState<Filter>('all')

  const { data: products, isLoading } = useQuery({
    queryKey: ['warehouse-uz-products'],
    queryFn: () => client.get<Product[]>('/warehouse-uz/products').then((r) => r.data),
  })

  const filtered = products?.filter((p) => filter === 'all' || productGroup(p.type) === filter)

  // Har filtr uchun nechta mahsulot borligi
  const count = (f: Filter) =>
    f === 'all' ? products?.length ?? 0 : products?.filter((p) => productGroup(p.type) === f).length ?? 0

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title="Ombordagi mahsulotlar" subtitle="Toshkent ombori holati" showBack />

      {/* Filtr tugmalari */}
      <div className="px-4 pt-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          {FILTERS.map((f) => {
            const active = filter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`shrink-0 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all flex items-center gap-1.5 ${
                  active ? 'text-white shadow-sm' : 'bg-slate-100 text-slate-500'
                }`}
                style={active ? { background: 'var(--brand-gradient)' } : undefined}
              >
                {f.label}
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${active ? 'bg-white/25' : 'bg-white'}`}>{count(f.key)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : !filtered?.length ? (
        <EmptyState icon={<IconBox size={30} />} title="Mahsulot yo'q" description="Bu turdagi mahsulot omborda yo'q" />
      ) : (
        <div className="px-4 pt-4 space-y-3">
          {filtered.map((p) => {
            const g = productGroup(p.type)
            const editable = p.status === 'in_warehouse_uz'
            // Haqiqiy variantlar (bo'sh backfill emas)
            const realVariants = p.variants?.filter((v) => v.size_label || v.quantity || v.weight_kg) ?? []
            // To'ldirilmagan: omborda turibdi, lekin birorta variant ham yo'q
            const incomplete = editable && realVariants.length === 0
            return (
              <div key={p.id} className={`bg-white rounded-2xl p-4 border shadow-sm ${incomplete ? 'border-amber-300' : 'border-slate-100'}`}>
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center text-xl shrink-0 overflow-hidden">
                    {p.image_url
                      ? <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                      : typeEmoji(p.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-slate-900 truncate">{p.name}</h3>
                      <StatusBadge tone={PRODUCT_STATUS[p.status].tone} dot>{PRODUCT_STATUS[p.status].text}</StatusBadge>
                    </div>
                    <p className="text-xs text-slate-400">{p.category || '—'}</p>

                    {incomplete ? (
                      <p className="text-xs text-amber-600 font-medium mt-1.5">⚠️ O'lcham qo'shilmagan — tahrirlang</p>
                    ) : (
                      <div className="mt-2 space-y-1.5">
                        {realVariants.map((v) => (
                          <div key={v.id} className="flex items-center gap-2 flex-wrap text-xs">
                            {v.size_label && (
                              <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg">{v.size_label}</span>
                            )}
                            {v.quantity > 0 && <span className={CHIP}>{v.quantity} dona</span>}
                            {g === 'boxed' && v.box_count != null && <span className={CHIP}>{v.box_count} quti</span>}
                            {v.weight_kg > 0 && <span className={CHIP}>{v.weight_kg} kg</span>}
                            {v.tare_kg != null && v.tare_kg > 0 && (
                              <>
                                <span className={CHIP}>{(v.weight_kg - v.tare_kg).toFixed(1)} kg sof</span>
                                <span className={CHIP_MUTED}>tara {v.tare_kg}</span>
                              </>
                            )}
                            {v.cargo_price > 0 && (
                              <span className="font-bold" style={{ color: 'var(--brand)' }}>
                                ${v.cargo_price}/{g === 'piece' ? 'dona' : 'kg'}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Tugmalar: Tahrirlash + Barkod chiqarish */}
                <div className="flex gap-2 mt-3">
                  {editable && (
                    <button
                      onClick={() => navigate(`/warehouse-uz/products/${p.id}/edit`)}
                      className={`press flex-1 py-2.5 rounded-xl text-sm font-semibold ${incomplete ? 'text-white' : 'bg-slate-100 text-slate-700'}`}
                      style={incomplete ? { background: 'var(--brand-gradient)' } : undefined}
                    >
                      {incomplete ? 'To\'ldirish' : '✏️ Tahrirlash'}
                    </button>
                  )}
                  <button
                    onClick={() => openLink(labelUrl(p.barcode, new Date().toISOString().slice(0, 10)))}
                    className="press flex-1 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 text-center"
                  >
                    🖨️ Barkod
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
