import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client from '@/shared/api/client'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { money } from '@/shared/lib/format'
import { Header, ListSkeleton, EmptyState, StatusBadge, Button, IconMoney } from '@/shared/ui'

interface Payment {
  id: number; carrier_name: string; carrier_number: number | null
  products_count: number; total_amount: number; status: 'unpaid' | 'paid'
}

export default function Payments() {
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
      <Header title="To'lovlar" subtitle="Yo'lovchilarga to'lov" showBack />

      {/* Jami to'lanmagan */}
      {data && data.length > 0 && (
        <div className="px-4 pt-4">
          <div className="rounded-3xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)' }}>
            <p className="text-sm text-white/60">Jami to'lanmagan</p>
            <p className="text-3xl font-extrabold mt-1">{money(totalUnpaid)}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState icon={<IconMoney size={30} />} title="To'lov yo'q" />
      ) : (
        <div className="px-4 pt-4 space-y-3 web-grid">
          {data.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-slate-900">{p.carrier_number ? `Yo'lovchi #${p.carrier_number}` : p.carrier_name}</p>
                  <p className="text-xs text-slate-400">{p.carrier_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{p.products_count} ta mahsulot</p>
                </div>
                <div className="text-right">
                  <p className="font-extrabold text-lg text-slate-900">{money(p.total_amount)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <StatusBadge tone={p.status === 'unpaid' ? 'yellow' : 'green'} dot>
                  {p.status === 'unpaid' ? "To'lanmagan" : "To'langan"}
                </StatusBadge>
                {p.status === 'unpaid' && (
                  <Button variant="success" onClick={() => markPaid.mutate(p.id)} className="!py-2 !px-4 text-sm">
                    To'landi
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
