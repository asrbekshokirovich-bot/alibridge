import { useQuery } from '@tanstack/react-query'
import client from '@/shared/api/client'
import { initials } from '@/shared/lib/format'
import { Header, ListSkeleton, EmptyState, StatusBadge, IconPlane } from '@/shared/ui'

interface Carrier {
  id: number; first_name: string; last_name: string; phone: string
  carrier_number: number; is_active: boolean; total_trips: number; has_cargo: boolean
}

export default function Carriers() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-carriers'],
    queryFn: () => client.get<Carrier[]>('/admin/carriers').then((r) => r.data),
  })

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title="Yo'lovchilar" subtitle="Barcha yo'lovchilar" showBack />

      {isLoading ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState icon={<IconPlane size={30} />} title="Yo'lovchi yo'q" />
      ) : (
        <div className="px-4 pt-4 space-y-3">
          {data.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3.5">
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold" style={{ background: 'var(--brand-gradient)' }}>
                  {initials(c.first_name, c.last_name)}
                </div>
                <span className="absolute -bottom-1 -right-1 bg-slate-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  #{c.carrier_number}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 truncate">{c.first_name} {c.last_name}</p>
                <p className="text-xs text-slate-400">{c.phone}</p>
                <p className="text-xs text-slate-400 mt-0.5">Jami reys: {c.total_trips}</p>
              </div>
              <StatusBadge tone={c.has_cargo ? 'green' : 'red'} dot>
                {c.has_cargo ? 'Yuk bor' : 'Yuk yo\'q'}
              </StatusBadge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
