import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
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
  const { openLink, notify } = useTelegram()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<Filter>('all')

  const { data: products, isLoading } = useQuery({
    queryKey: ['warehouse-uz-products'],
    queryFn: () => client.get<Product[]>('/warehouse-uz/products').then((r) => r.data),
  })

  const remove = useMutation({
    mutationFn: (id: number) => client.delete(`/warehouse-uz/products/${id}`),
    onSuccess: () => {
      notify('success')
      qc.invalidateQueries({ queryKey: ['warehouse-uz-products'] })
    },
    onError: (err) => { alert(extractErrorMessage(err)); notify('error') },
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
        <div className="px-4 pt-4 space-y-3 web-grid">
          {filtered.map((p) => {
            const g = productGroup(p.type)
            const editable = p.status === 'in_warehouse_uz'
            // Haqiqiy variantlar (bo'sh backfill emas)
            const realVariants = p.variants?.filter((v) => v.size_label || v.quantity || v.weight_kg) ?? []
            // To'ldirilmagan: omborda turibdi, lekin birorta variant ham yo'q
            const incomplete = editable && realVariants.length === 0
            // Umumiy soni (variantlar yig'indisi)
            const totalQty = realVariants.reduce((s, v) => s + (v.quantity || 0), 0)
            // Tekstil/kiloli uchun jami sof kg (tara ayirilgan)
            const totalKg = realVariants.reduce((s, v) => s + Math.max(0, (v.weight_kg || 0) - (v.tare_kg || 0)), 0)
            const unit = g === 'piece' ? 'dona' : 'kg'
            // Jami qatori: donada hamma turda, kg faqat kiloli/tekstilda. Bo'sh segmentlar tushiriladi.
            const jamiParts = [
              totalQty > 0 ? `${totalQty} dona` : '',
              g !== 'piece' && totalKg >= 0.1 ? `${totalKg.toFixed(1)} kg` : '',
            ].filter(Boolean)
            return (
              <div key={p.id} className={`bg-white rounded-2xl p-3.5 border shadow-sm ${incomplete ? 'border-amber-300' : 'border-slate-100'}`}>
                <div className="flex items-stretch gap-3">
                  {/* Chap: katta rasm */}
                  <div className="w-24 h-24 rounded-xl bg-slate-50 flex items-center justify-center text-3xl shrink-0 overflow-hidden self-start">
                    {p.image_url
                      ? <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                      : typeEmoji(p.type)}
                  </div>

                  {/* O'rta: nomi, katalog, o'lchamlar + narx, jami */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 truncate flex-1">{p.name}</h3>
                      <StatusBadge tone={PRODUCT_STATUS[p.status].tone} dot>{PRODUCT_STATUS[p.status].text}</StatusBadge>
                    </div>
                    <p className="text-xs text-slate-400 truncate">{p.category || '—'}</p>

                    {incomplete ? (
                      <p className="text-xs text-amber-600 font-medium mt-1.5">⚠️ O'lcham qo'shilmagan — tahrirlang</p>
                    ) : (
                      <>
                        <div className="mt-2 space-y-1">
                          {realVariants.map((v) => (
                            <div key={v.id} className="flex items-center gap-2 flex-wrap text-xs">
                              {v.size_label && (
                                <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg">{v.size_label}</span>
                              )}
                              {v.quantity > 0 && <span className={CHIP}>{v.quantity} dona</span>}
                              {g === 'boxed' && v.box_count != null && v.box_count > 0 && <span className={CHIP}>{v.box_count} quti</span>}
                              {v.weight_kg > 0 && <span className={CHIP}>{v.weight_kg} kg</span>}
                              {v.tare_kg != null && v.tare_kg > 0 && (
                                <>
                                  <span className={CHIP}>{Math.max(0, v.weight_kg - v.tare_kg).toFixed(1)} kg sof</span>
                                  <span className={CHIP_MUTED}>tara {v.tare_kg}</span>
                                </>
                              )}
                              {v.cargo_price > 0 && (
                                <span className="font-bold ml-auto" style={{ color: 'var(--brand)' }}>
                                  ${v.cargo_price}/{unit}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                        {jamiParts.length > 0 && (
                          <p className="text-xs font-semibold text-slate-500 mt-1.5">
                            Jami: {jamiParts.join(' · ')}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* O'ng: barkod + tahrirlash + o'chirish (vertikal) */}
                  <div className="flex flex-col gap-1.5 shrink-0 w-[88px]">
                    <button
                      onClick={() => openLink(labelUrl(p.barcode, new Date().toISOString().slice(0, 10)))}
                      className="press py-2 rounded-xl text-[11px] font-semibold bg-slate-100 text-slate-700 flex flex-col items-center gap-0.5"
                    >
                      <span>🖨️ Barkod</span>
                      <span className="text-[10px] text-slate-400 font-mono truncate w-full text-center">{p.barcode}</span>
                    </button>
                    {editable && (
                      <button
                        onClick={() => navigate(`/warehouse-uz/products/${p.id}/edit`)}
                        className={`press py-2 rounded-xl text-[11px] font-semibold ${incomplete ? 'text-white' : 'bg-slate-100 text-slate-700'}`}
                        style={incomplete ? { background: 'var(--brand-gradient)' } : undefined}
                      >
                        {incomplete ? 'To\'ldirish' : '✏️ Tahrirlash'}
                      </button>
                    )}
                    {editable && (
                      <button
                        onClick={() => {
                          if (confirm(`"${p.name}" o'chirilsinmi? Bu amalni qaytarib bo'lmaydi.`)) remove.mutate(p.id)
                        }}
                        disabled={remove.isPending && remove.variables === p.id}
                        className="press py-2 rounded-xl text-[11px] font-semibold bg-red-50 text-red-600 disabled:opacity-50"
                      >
                        🗑️ O'chirish
                      </button>
                    )}
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
