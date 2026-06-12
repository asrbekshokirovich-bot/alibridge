import { useQuery } from '@tanstack/react-query'
import client from '@/shared/api/client'
import type { CarrierMyProduct } from '@/shared/types'
import { Header, IconHandshake, IconBox, ListSkeleton } from '@/shared/ui'
import { useAuthStore } from '@/shared/store/auth'

export default function AutoReceive() {
  const user = useAuthStore((s) => s.user)
  const carrierNumber = user?.carrier_number

  // Kuryer aeroportда topshirgan, hozir yo'lovchida turgan yuklar
  const { data: products, isLoading } = useQuery({
    queryKey: ['carrier-my-products'],
    queryFn: () => client.get<CarrierMyProduct[]>('/carrier/my-products').then((r) => r.data),
    refetchInterval: 15000, // kuryer topshirsa o'zi yangilanadi
  })

  const total = (products ?? []).reduce((s, p) => s + p.quantity, 0)

  return (
    <div className="min-h-screen pb-28 animate-fade-in">
      <Header title="Kuryerdan qabul" subtitle="Raqamingizni kuryerga ko'rsating" />

      {/* Info banner */}
      <div className="px-4 pt-4">
        <div className="rounded-2xl p-4 flex gap-3" style={{ background: 'var(--brand-gradient-soft)' }}>
          <div className="text-red-500 shrink-0"><IconHandshake size={22} /></div>
          <p className="text-[13px] text-red-900/80 leading-snug">
            Aeroportда kuryerga quyidagi raqamingizni ayting. Kuryer barkodlarni skanlab,
            yuklaringizni sizga topshiradi.
          </p>
        </div>
      </div>

      {/* Yo'lovchi raqami — katta ko'rinishda */}
      <div className="px-4 pt-8 flex flex-col items-center">
        {carrierNumber ? (
          <>
            <p className="text-sm text-slate-500 mb-2">Sizning yo'lovchi raqamingiz</p>
            <div
              className="w-40 h-40 rounded-[2rem] flex items-center justify-center text-white shadow-[var(--shadow-brand)]"
              style={{ background: 'var(--brand-gradient)' }}
            >
              <span className="text-6xl font-extrabold tracking-tight">#{carrierNumber}</span>
            </div>
            <p className="text-[13px] text-slate-400 mt-5 text-center max-w-[260px]">
              Kuryer bu raqamni kiritib, yuklaringizni skanlaydi — yuklar avtomatik hisobingizga o'tadi.
            </p>
          </>
        ) : (
          <p className="text-slate-500 text-sm text-center mt-10">
            Yo'lovchi raqamingiz hali tayinlanmagan. Iltimos, qaytadan kiring.
          </p>
        )}
      </div>

      {/* Qabul qilingan yuklar — kuryer topshirgan, hozir yo'lovchida */}
      <div className="px-4 pt-10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-900 text-[15px]">Qabul qilingan yuklar</h3>
          {total > 0 && (
            <span className="text-xs font-bold text-white px-2.5 py-0.5 rounded-full" style={{ background: 'var(--brand)' }}>
              {total} dona
            </span>
          )}
        </div>

        {isLoading ? (
          <ListSkeleton />
        ) : !products?.length ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
            <div className="text-slate-300 flex justify-center mb-2"><IconBox size={28} /></div>
            <p className="text-sm text-slate-400">Hali yuk qabul qilinmagan</p>
            <p className="text-xs text-slate-300 mt-1">Kuryer topshirgach shu yerda chiqadi</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
            {products.map((p) => (
              <div key={`${p.product_id}-${p.size_label}`} className="flex items-center gap-3 p-3.5">
                <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                  {p.image_url
                    ? <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                    : <IconBox size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-900 truncate">
                    {p.category || p.product_name}
                    {p.size_label && <span className="text-slate-400 font-normal"> · {p.size_label}</span>}
                  </p>
                  <p className="text-xs text-slate-400">
                    {p.barcode}{p.received_at && ` · ${p.received_at}`}
                  </p>
                </div>
                <span className="text-sm font-bold text-slate-700 shrink-0">{p.quantity} dona</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
