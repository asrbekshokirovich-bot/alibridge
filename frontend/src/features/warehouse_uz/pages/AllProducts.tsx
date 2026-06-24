import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import client from '@/shared/api/client'
import { money } from '@/shared/lib/format'
import { isPiece, unitWord } from '@/shared/lib/product'
import { Header, ListSkeleton, EmptyState, StatusBadge, Sheet, IconBox } from '@/shared/ui'
import type { Product } from '@/shared/types'

interface StageQuantity { holder_type: string; label: string; quantity: number }
interface Distribution {
  product_id: number; barcode: string; product_name: string
  total: number; stages: StageQuantity[]
}

export default function AllProducts() {
  const { t } = useTranslation()
  const [filter, setFilter] = useState('all')
  const [openId, setOpenId] = useState<number | null>(null)

  const STATUS_LABEL: Record<string, { label: string; tone: 'green' | 'yellow' | 'red' | 'gray' | 'blue' }> = {
    in_warehouse_uz: { label: t('Toshkent omborida'), tone: 'blue' },
    pending_admin: { label: t('Tasdiq kutilmoqda'), tone: 'yellow' },
    confirmed: { label: t('Tasdiqlangan'), tone: 'green' },
    with_courier_uz: { label: t('Kuryerda'), tone: 'yellow' },
    with_carrier: { label: t('Yo\'lovchida'), tone: 'yellow' },
    delivered_tr: { label: t('Turkiyada'), tone: 'green' },
    damaged: { label: t('Shikastlangan'), tone: 'red' },
  }

  // Filtr: status guruhlari
  const FILTERS: { key: string; label: string; match: (s: string) => boolean }[] = [
    { key: 'all', label: t('Barchasi'), match: () => true },
    { key: 'warehouse', label: t('Omborda'), match: (s) => s === 'in_warehouse_uz' },
    { key: 'moving', label: t('Yo\'lda'), match: (s) => ['with_courier_uz', 'with_carrier', 'pending_admin', 'confirmed'].includes(s) },
    { key: 'delivered', label: t('Yetkazilgan'), match: (s) => s === 'delivered_tr' },
    { key: 'damaged', label: t('Shikast'), match: (s) => s === 'damaged' },
  ]

  const { data, isLoading } = useQuery({
    queryKey: ['warehouse-uz-all-products'],
    queryFn: () => client.get<Product[]>('/warehouse-uz/all-products').then((r) => r.data),
  })

  // Tanlangan mahsulotning bosqichlar bo'ylab taqsimoti
  const { data: dist, isLoading: distLoading } = useQuery({
    queryKey: ['warehouse-uz-distribution', openId],
    queryFn: () => client.get<Distribution>(`/warehouse-uz/products/${openId}/distribution`).then((r) => r.data),
    enabled: openId !== null,
  })

  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0]
  const filtered = data?.filter((p) => active.match(p.status))
  const count = (f: typeof FILTERS[number]) => data?.filter((p) => f.match(p.status)).length ?? 0

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title={t('Barcha yuklar')} subtitle={t('Yuk harakatini kuzatish')} showBack />

      {/* Status filtri */}
      <div className="px-4 pt-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          {FILTERS.map((f) => {
            const isActive = filter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="shrink-0 px-3.5 py-2 rounded-full text-[13px] font-semibold transition-all flex items-center gap-1.5 border"
                style={isActive
                  ? { background: 'var(--royal)', color: '#fff', borderColor: 'transparent' }
                  : { background: 'var(--surface)', color: 'var(--muted)', borderColor: 'var(--line)' }}
              >
                {f.label}
                <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={isActive ? { background: 'rgba(255,255,255,0.22)' } : { background: 'var(--surface2)' }}>{count(f)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : !filtered?.length ? (
        <EmptyState icon={<IconBox size={30} />} title={t('Yuk yo\'q')} description={t('Bu holatda yuk topilmadi')} />
      ) : (
        <div className="px-4 pt-4 space-y-3 web-grid">
          {filtered.map((p) => {
            const st = STATUS_LABEL[p.status] ?? { label: p.status, tone: 'gray' as const }
            return (
              <button key={p.id} onClick={() => setOpenId(p.id)}
                className="press w-full text-left rounded-2xl p-4 border" style={{ background: 'var(--card-gradient)', borderColor: 'var(--line2)', boxShadow: 'var(--shadow-md)' }}>
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(106,163,255,0.14)', color: '#6aa3ff' }}>
                    <IconBox size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14.5px] font-bold truncate" style={{ color: 'var(--ink)' }}>{p.name}</p>
                    <p className="text-xs font-mono" style={{ color: 'var(--muted3)' }}>{p.barcode}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <StatusBadge tone={st.tone} dot>{st.label}</StatusBadge>
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>
                        {isPiece(p.type) ? t('{{quantity}} dona', { quantity: p.quantity }) : t('{{weight}} kg · {{quantity}} dona', { weight: p.weight_kg, quantity: p.quantity })}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--brand-light)' }}>{money(p.cargo_price)}</p>
                    <p className="text-[11px] tabular-nums" style={{ color: 'var(--muted3)' }}>${p.cargo_price}/{unitWord(p.type)}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Bosqichlar bo'ylab taqsimot */}
      <Sheet open={openId !== null} onClose={() => setOpenId(null)}>
        {dist && (
          <div className="px-5 pt-2">
            <h3 className="font-bold mb-1" style={{ color: 'var(--ink)' }}>{dist.product_name}</h3>
            <p className="text-xs font-mono mb-4" style={{ color: 'var(--muted3)' }}>{dist.barcode} · {t('jami {{total}} ta', { total: dist.total })}</p>
            {dist.stages.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: 'var(--muted3)' }}>{t('Hali taqsimlanmagan')}</p>
            ) : (
              <div className="space-y-2 pb-2">
                {dist.stages.map((s) => (
                  <div key={s.holder_type} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: 'var(--surface2)' }}>
                    <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{s.label}</span>
                    <span className="text-sm font-bold text-white px-2.5 py-0.5 rounded-lg tabular-nums" style={{ background: 'var(--royal)' }}>
                      {t('{{quantity}} ta', { quantity: s.quantity })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {distLoading && <div className="px-5 py-6"><ListSkeleton /></div>}
      </Sheet>
    </div>
  )
}
