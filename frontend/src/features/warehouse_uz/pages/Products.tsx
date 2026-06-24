import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client, { extractErrorMessage } from '@/shared/api/client'
import type { Product } from '@/shared/types'
import { PRODUCT_STATUS } from '@/shared/lib/status'
import { productGroup, labelUrl, type ProductGroup } from '@/shared/lib/product'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { Header, ListSkeleton, EmptyState, StatusBadge, IconBox, IconAlert, IconPencil, IconTrash } from '@/shared/ui'

type Filter = 'all' | ProductGroup

const CHIP = 'text-xs font-semibold px-2 py-0.5 rounded-lg'
const CHIP_STYLE = { background: 'rgba(255,255,255,0.06)', color: 'var(--muted)' } as const
const CHIP_MUTED = 'text-xs font-medium px-2 py-0.5 rounded-lg'
const CHIP_MUTED_STYLE = { background: 'var(--surface2)', color: 'var(--muted3)' } as const

export default function Products() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { openLink, notify } = useTelegram()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<Filter>('all')

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: t('Umumiy') },
    { key: 'piece', label: t('Donali') },
    { key: 'boxed', label: t('Kiloli') },
    { key: 'textile', label: t('Tekstil') },
  ]

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
      <Header title={t('Ombordagi mahsulotlar')} subtitle={t('Toshkent ombori holati')} showBack />

      {/* Filtr tugmalari */}
      <div className="px-4 pt-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          {FILTERS.map((f) => {
            const active = filter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="shrink-0 px-3.5 py-2 rounded-full text-[13px] font-semibold transition-all flex items-center gap-1.5 border"
                style={active
                  ? { background: 'var(--royal)', color: '#fff', borderColor: 'transparent' }
                  : { background: 'var(--surface)', color: 'var(--muted)', borderColor: 'var(--line)' }}
              >
                {f.label}
                <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={active ? { background: 'rgba(255,255,255,0.22)' } : { background: 'var(--surface2)' }}>{count(f.key)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : !filtered?.length ? (
        <EmptyState icon={<IconBox size={30} />} title={t("Mahsulot yo'q")} description={t("Bu turdagi mahsulot omborda yo'q")} />
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
              totalQty > 0 ? t('{{n}} dona', { n: totalQty }) : '',
              g !== 'piece' && totalKg >= 0.1 ? t('{{n}} kg', { n: totalKg.toFixed(1) }) : '',
            ].filter(Boolean)
            return (
              <div key={p.id} className="rounded-2xl p-3.5 border" style={{ background: 'var(--card-gradient)', borderColor: incomplete ? 'var(--amber)' : 'var(--line)', boxShadow: 'var(--shadow-md)' }}>
                <div className="flex items-stretch gap-3">
                  {/* Chap: katta rasm */}
                  <div className="w-24 h-24 rounded-xl flex items-center justify-center shrink-0 overflow-hidden self-start" style={{ background: 'rgba(106,163,255,0.14)', color: '#6aa3ff' }}>
                    {p.image_url
                      ? <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                      : <IconBox size={34} />}
                  </div>

                  {/* O'rta: nomi, katalog, o'lchamlar + narx, jami */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14.5px] font-bold truncate flex-1" style={{ color: 'var(--ink)' }}>{p.name}</h3>
                      <StatusBadge tone={PRODUCT_STATUS[p.status].tone} dot>{PRODUCT_STATUS[p.status].text}</StatusBadge>
                    </div>
                    <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{p.category || '—'}</p>

                    {/* Omborda hozir qolgan miqdor (split custody — bir qism kuryerda) */}
                    {p.in_warehouse_qty != null && (
                      p.in_warehouse_qty > 0 ? (
                        <span className="inline-block mt-1.5 text-xs font-bold px-2 py-0.5 rounded-lg" style={{ color: 'var(--green)', background: 'rgba(52,211,153,0.14)' }}>
                          {t('Omborda: {{n}} dona', { n: p.in_warehouse_qty })}
                        </span>
                      ) : (
                        <span className="inline-block mt-1.5 text-xs font-bold px-2 py-0.5 rounded-lg" style={{ color: 'var(--red)', background: 'rgba(255,107,107,0.14)' }}>
                          {t('Omborda qolmadi')}
                        </span>
                      )
                    )}

                    {incomplete ? (
                      <p className="text-xs font-semibold mt-1.5 flex items-center gap-1" style={{ color: 'var(--amber-d)' }}><IconAlert size={13} /> {t("O'lcham qo'shilmagan — tahrirlang")}</p>
                    ) : (
                      <>
                        <div className="mt-2 space-y-1">
                          {realVariants.map((v) => (
                            <div key={v.id} className="flex items-center gap-2 flex-wrap text-xs">
                              {v.size_label && (
                                <span className="font-bold px-2 py-0.5 rounded-lg" style={{ color: 'var(--ink)', background: 'rgba(255,255,255,0.06)' }}>{v.size_label}</span>
                              )}
                              {v.quantity > 0 && <span className={CHIP} style={CHIP_STYLE}>{t('{{n}} dona', { n: v.quantity })}</span>}
                              {g === 'boxed' && v.box_count != null && v.box_count > 0 && <span className={CHIP} style={CHIP_STYLE}>{t('{{n}} quti', { n: v.box_count })}</span>}
                              {v.weight_kg > 0 && <span className={CHIP} style={CHIP_STYLE}>{t('{{n}} kg', { n: v.weight_kg })}</span>}
                              {v.tare_kg != null && v.tare_kg > 0 && (
                                <>
                                  <span className={CHIP} style={CHIP_STYLE}>{t('{{n}} kg sof', { n: Math.max(0, v.weight_kg - v.tare_kg).toFixed(1) })}</span>
                                  <span className={CHIP_MUTED} style={CHIP_MUTED_STYLE}>{t('tara {{n}}', { n: v.tare_kg })}</span>
                                </>
                              )}
                              {v.cargo_price > 0 && (
                                <span className="font-bold ml-auto tabular-nums" style={{ color: 'var(--brand-light)' }}>
                                  ${v.cargo_price}/{unit}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                        {jamiParts.length > 0 && (
                          <p className="text-xs font-semibold mt-1.5" style={{ color: 'var(--muted)' }}>
                            {t('Jami:')} {jamiParts.join(' · ')}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* O'ng: barkod + tahrirlash + o'chirish (vertikal) */}
                  <div className="flex flex-col gap-1.5 shrink-0 w-[88px]">
                    <button
                      onClick={() => openLink(labelUrl(p.barcode, new Date().toISOString().slice(0, 10)))}
                      className="press py-2 rounded-xl text-[11px] font-bold flex flex-col items-center gap-0.5 border"
                      style={{ background: 'var(--surface2)', borderColor: 'var(--line2)', color: 'var(--ink)' }}
                    >
                      <span className="flex items-center gap-1"><IconBox size={13} /> {t('Barkod')}</span>
                      <span className="text-[10px] font-mono truncate w-full text-center" style={{ color: 'var(--muted3)' }}>{p.barcode}</span>
                    </button>
                    {editable && (
                      <button
                        onClick={() => navigate(`/warehouse-uz/products/${p.id}/edit`)}
                        className="press py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 border"
                        style={incomplete
                          ? { background: 'var(--royal)', color: '#fff', borderColor: 'transparent' }
                          : { background: 'var(--surface2)', color: 'var(--ink)', borderColor: 'var(--line2)' }}
                      >
                        {incomplete ? t("To'ldirish") : <><IconPencil size={13} /> {t('Tahrirlash')}</>}
                      </button>
                    )}
                    {editable && (
                      <button
                        onClick={() => {
                          if (confirm(t('"{{name}}" o\'chirilsinmi? Bu amalni qaytarib bo\'lmaydi.', { name: p.name }))) remove.mutate(p.id)
                        }}
                        disabled={remove.isPending && remove.variables === p.id}
                        className="press py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                        style={{ background: 'rgba(255,107,107,0.14)', color: 'var(--red)' }}
                      >
                        <IconTrash size={13} /> {t("O'chirish")}
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
