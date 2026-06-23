import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import client from '@/shared/api/client'
import type { ProductType } from '@/shared/types'
import { initials } from '@/shared/lib/format'
import { isPiece } from '@/shared/lib/product'
import { Header, ListSkeleton, EmptyState, StatusBadge, Sheet, IconPlane, IconBox } from '@/shared/ui'

interface Carrier {
  id: number; first_name: string; last_name: string; phone: string
  carrier_number: number; is_active: boolean; total_trips: number; has_cargo: boolean
}

interface HeldCargo {
  product_id: number; barcode: string; product_name: string
  type: ProductType; size_label: string; quantity: number
}

export default function Carriers() {
  const { t } = useTranslation()
  const [open, setOpen] = useState<Carrier | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['warehouse-uz-carriers'],
    queryFn: () => client.get<Carrier[]>('/warehouse-uz/carriers').then((r) => r.data),
  })

  // Tanlangan yo'lovchining yuklari (faqat sheet ochilganda)
  const { data: cargo, isLoading: cargoLoading } = useQuery({
    queryKey: ['warehouse-uz-carrier-products', open?.id],
    queryFn: () => client.get<HeldCargo[]>(`/warehouse-uz/carriers/${open!.id}/products`).then((r) => r.data),
    enabled: !!open,
  })

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title={t("Yo'lovchilar")} subtitle={t('Yuk holati va tafsiloti')} showBack />

      {isLoading ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState icon={<IconPlane size={30} />} title={t("Yo'lovchi yo'q")} />
      ) : (
        <div className="px-4 pt-4 space-y-3 web-grid">
          {data.map((c) => (
            <button
              key={c.id}
              onClick={() => c.has_cargo && setOpen(c)}
              disabled={!c.has_cargo}
              className="w-full rounded-2xl p-4 border flex items-center gap-3.5 text-left disabled:cursor-default"
              style={{ background: 'var(--surface)', borderColor: 'var(--line)', boxShadow: 'var(--shadow-md)' }}
            >
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold" style={{ background: 'linear-gradient(135deg, #1A3A6C, #132A4D)' }}>
                  {initials(c.first_name, c.last_name)}
                </div>
                <span className="absolute -bottom-1 -right-1 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--royal)' }}>
                  #{c.carrier_number}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14.5px] font-bold truncate" style={{ color: 'var(--ink)' }}>{c.first_name} {c.last_name}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{c.phone}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted2)' }}>{t('Jami reys: {{count}}', { count: c.total_trips })}</p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <StatusBadge tone={c.has_cargo ? 'green' : 'gray'} dot>
                  {c.has_cargo ? t('Yuk bor') : t("Yuk yo'q")}
                </StatusBadge>
                {c.has_cargo && (
                  <span className="text-[11px]" style={{ color: 'var(--brand-light)' }}>{t("Yuklarni ko'rish")}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Yo'lovchining yuklari */}
      <Sheet open={!!open} onClose={() => setOpen(null)}>
        {open && (
          <div className="px-5 pt-2">
            <h3 className="font-bold mb-1" style={{ color: 'var(--ink)' }}>{open.first_name} {open.last_name}</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>{t("Yo'lovchi #{{number}} olib ketayotgan yuklar", { number: open.carrier_number })}</p>

            {cargoLoading ? (
              <ListSkeleton />
            ) : !cargo?.length ? (
              <p className="text-sm py-6 text-center" style={{ color: 'var(--muted3)' }}>{t('Yuk topilmadi')}</p>
            ) : (
              <div className="space-y-2.5 pb-2">
                {cargo.map((p) => (
                  <div key={`${p.product_id}:${p.size_label}`} className="flex items-center gap-3 rounded-xl p-3" style={{ background: 'var(--surface2)' }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(106,163,255,0.14)', color: '#6aa3ff' }}>
                      <IconBox size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14.5px] font-bold truncate" style={{ color: 'var(--ink)' }}>
                        {p.product_name}{p.size_label ? ` · ${p.size_label}` : ''}
                      </p>
                      <p className="text-xs font-mono" style={{ color: 'var(--muted3)' }}>{p.barcode}</p>
                    </div>
                    <span className="text-xs font-bold text-white px-2 py-0.5 rounded-lg shrink-0 tabular-nums" style={{ background: 'var(--royal)' }}>
                      {p.quantity} {isPiece(p.type) ? t('dona') : t('ta')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Sheet>
    </div>
  )
}
