import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/shared/store/auth'
import { DashboardHeader, RouteProgress, StatusBadge, IconBox, IconChevronRight } from '@/shared/ui'
import { MOCK_ORDERS, ORDER_STATUS_META, som } from '../data'

export default function OrdererHome() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  // TODO(backend): GET /orderer/orders — hozircha MOCK
  const orders = MOCK_ORDERS
  const active = orders.find((o) => o.status === 'with_carrier') ?? orders.find((o) => o.status !== 'delivered')

  const open = (id: string) => navigate(`/orderer/track/${id}`)

  return (
    <div className="min-h-screen pb-28 animate-fade-in">
      <DashboardHeader role={t('Buyurtmachi')} name={user?.first_name} />

      <div className="px-4 -mt-7 relative z-10 space-y-5">
        {/* Faol jo'natma */}
        {active && (
          <div className="ab-card p-4">
            <div className="flex items-center justify-between mb-3.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--lime)' }}>
                {t("Faol jo'natma")}
              </p>
              <StatusBadge tone={ORDER_STATUS_META[active.status].tone} dot>
                {t(ORDER_STATUS_META[active.status].key)}
              </StatusBadge>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(106,163,255,0.14)', color: 'var(--blue)' }}>
                <IconBox size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-bold truncate" style={{ color: 'var(--ink)' }}>{active.name}</p>
                <p className="text-[13px] font-bold tabnum" style={{ color: 'var(--lime)' }}>{som(active.price)}</p>
              </div>
            </div>

            <RouteProgress
              fromLabel={t('Toshkent')} toLabel={t('Istanbul')}
              progress={active.routeProgress} className="mb-4"
            />

            <button onClick={() => open(active.id)}
              className="press w-full h-[46px] rounded-[13px] font-bold text-[14px] flex items-center justify-center gap-2"
              style={{ background: 'var(--royal)', color: '#fff', boxShadow: 'var(--shadow-brand)' }}>
              {t('Kuzatish')}
              <IconChevronRight size={17} />
            </button>
          </div>
        )}

        {/* Buyurtmalarim */}
        <div>
          <p className="flex items-center gap-2 px-1 mb-2.5 text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: 'var(--muted2)' }}>
            <span style={{ width: 14, height: 2, borderRadius: 2, background: 'var(--lime)' }} />
            {t('Buyurtmalarim')}
          </p>
          <div className="space-y-2.5">
            {orders.map((o) => {
              const meta = ORDER_STATUS_META[o.status]
              return (
                <button key={o.id} onClick={() => open(o.id)}
                  className="ab-card w-full p-3.5 flex items-center gap-3 text-left cursor-pointer">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'var(--surface2)', border: '1px solid var(--line)', color: 'var(--muted)' }}>
                    <IconBox size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold truncate" style={{ color: 'var(--ink)' }}>{o.name}</p>
                    <p className="text-[12px] font-semibold tabnum mt-0.5" style={{ color: 'var(--muted)' }}>{som(o.price)}</p>
                  </div>
                  <StatusBadge tone={meta.tone}>{t(meta.key)}</StatusBadge>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
