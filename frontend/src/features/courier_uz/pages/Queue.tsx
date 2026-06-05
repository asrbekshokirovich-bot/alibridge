import { useQuery } from '@tanstack/react-query'
import client from '@/shared/api/client'
import { Header, ListSkeleton, EmptyState, StatusBadge, IconList } from '@/shared/ui'

interface QueueItem {
  id: number; carrier_name: string; carrier_number: number
  address: string; products_count: number
  status: 'pending' | 'in_progress' | 'done'
}

const map = {
  pending: { text: 'Kutilmoqda', tone: 'yellow' as const },
  in_progress: { text: 'Jarayonda', tone: 'blue' as const },
  done: { text: 'Bajarildi', tone: 'green' as const },
}

export default function CourierUzQueue() {
  const { data, isLoading } = useQuery({
    queryKey: ['courier-uz-queue'],
    queryFn: () => client.get<QueueItem[]>('/courier-uz/queue').then((r) => r.data),
  })

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header title="Yetkazish navbati" subtitle="Yo'lovchilardan olish kerak" showBack />

      {isLoading ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState icon={<IconList size={30} />} title="Navbat bo'sh" description="Hozircha olish kerak bo'lgan yuk yo'q" />
      ) : (
        <div className="px-4 pt-4 space-y-3">
          {data.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-900">Yo'lovchi #{item.carrier_number}</span>
                <StatusBadge tone={map[item.status].tone} dot>{map[item.status].text}</StatusBadge>
              </div>
              <p className="text-sm text-slate-600 mb-1">{item.carrier_name}</p>
              <div className="flex items-center gap-1.5 text-sm text-slate-500">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M12 13a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {item.address}
              </div>
              <div className="mt-2 inline-flex text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                {item.products_count} ta mahsulot
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
