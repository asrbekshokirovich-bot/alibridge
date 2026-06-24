import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import client from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { money } from '@/shared/lib/format'
import { Header, ListSkeleton, EmptyState, StatusBadge, Button, IconMoney } from '@/shared/ui'

interface Payment {
  id: number; carrier_name: string; carrier_number: number | null
  products_count: number; total_amount: number; status: 'unpaid' | 'paid'
}

export default function Payments() {
  const { t } = useTranslation()
  const { notify } = useTelegram()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-payments'],
    queryFn: () => client.get<Payment[]>('/admin/payments').then((r) => r.data),
  })

  const markPaid = useMutation({
    mutationFn: (id: number) => client.post(`/admin/payments/${id}/mark-paid`),
    onSuccess: () => { notify('success'); qc.invalidateQueries({ queryKey: ['admin-payments'] }) },
  })

  const totalUnpaid = data?.filter((p) => p.status === 'unpaid').reduce((s, p) => s + p.total_amount, 0) ?? 0

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title={t("To'lovlar")} subtitle={t("Yo'lovchilarga to'lov")} showBack />

      {/* Jami to'lanmagan */}
      {data && data.length > 0 && (
        <div className="px-4 pt-4">
          <div className="relative overflow-hidden rounded-2xl p-5 text-white" style={{ background: 'var(--brand-gradient)', boxShadow: 'var(--shadow-brand)' }}>
            <span className="absolute pointer-events-none" style={{ top: '-40px', right: '-26px', width: '130px', height: '130px', background: 'var(--lime)', opacity: 0.14, transform: 'rotate(42deg)', borderRadius: '28px' }} />
            <p className="relative text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--lime)' }}>{t("Jami to'lanmagan")}</p>
            <p className="relative text-[30px] font-extrabold mt-1.5 tabular-nums leading-none">{money(totalUnpaid)}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState icon={<IconMoney size={30} />} title={t("To'lov yo'q")} />
      ) : (
        <div className="px-4 pt-4 space-y-3 web-grid">
          {data.map((p) => (
            <div key={p.id} className="rounded-2xl p-4 border" style={{ background: 'var(--card-gradient)', borderColor: 'var(--line2)', boxShadow: 'var(--shadow-md)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-[14.5px]" style={{ color: 'var(--ink)' }}>{p.carrier_number ? t("Yo'lovchi #{{number}}", { number: p.carrier_number }) : p.carrier_name}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{p.carrier_name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted2)' }}>{t('{{count}} ta mahsulot', { count: p.products_count })}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-extrabold text-lg tabular-nums" style={{ color: 'var(--lime-d)' }}>{money(p.total_amount)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <StatusBadge tone={p.status === 'unpaid' ? 'yellow' : 'green'} dot>
                  {p.status === 'unpaid' ? t("To'lanmagan") : t("To'langan")}
                </StatusBadge>
                {p.status === 'unpaid' && (
                  <Button variant="success" onClick={() => markPaid.mutate(p.id)} className="!py-2 !px-4 text-sm">
                    {t("To'landi")}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
