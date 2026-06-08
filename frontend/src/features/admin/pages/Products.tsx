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
  with_carrier: { label: 'Yo\'lovchida', tone: 'yellow' },
  delivered_tr: { label: 'Turkiyada', tone: 'green' },
  damaged: { label: 'Shikastlangan', tone: 'red' },
}

export default function Products() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () => client.get<Product[]>('/admin/products').then((r) => r.data),
  })

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title="Mahsulotlar" subtitle="Barcha yuklar" showBack />

      {isLoading ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState icon={<IconBox size={30} />} title="Mahsulot yo'q" description="Hali mahsulot qo'shilmagan" />
      ) : (
        <div className="px-4 pt-4 space-y-3">
          {data.map((p) => {
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
