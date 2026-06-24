import { useParams, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Header, Timeline, IconBox } from '@/shared/ui'
import { MOCK_ORDERS, buildTimeline, som } from '../data'

export default function OrdererTracking() {
  const { t } = useTranslation()
  const { id } = useParams()

  // TODO(backend): GET /orderer/orders/{id}/track — hozircha MOCK
  const order = MOCK_ORDERS.find((o) => o.id === id)
  if (!order) return <Navigate to="/orderer" replace />

  const steps = buildTimeline(order, (k) => t(k))

  return (
    <div className="min-h-screen pb-28 animate-fade-in">
      <Header title={t('Kuzatish')} subtitle={order.barcode} showBack />

      <div className="px-4 pt-4 space-y-4">
        {/* Mahsulot sarlavhasi + narx */}
        <div className="glass rounded-2xl p-4 flex items-center gap-3.5"
          style={{ boxShadow: 'var(--shadow-md)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(106,163,255,0.14)', color: 'var(--blue)' }}>
            <IconBox size={26} />
          </div>
          <div className="min-w-0">
            <p className="text-[17px] font-extrabold truncate" style={{ color: 'var(--ink)' }}>{order.name}</p>
            <p className="text-[15px] font-extrabold tabnum mt-0.5" style={{ color: 'var(--lime)' }}>{som(order.price)}</p>
          </div>
        </div>

        {/* Yo'l xaritasi (vertikal timeline) */}
        <div className="glass rounded-2xl p-5" style={{ boxShadow: 'var(--shadow-md)' }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-4" style={{ color: 'var(--muted2)' }}>
            {t("Yo'l xaritasi")}
          </p>
          <Timeline steps={steps} />
        </div>

        {/* Yetkazib berish kodi (lime) */}
        {order.deliveryCode && (
          <div className="rounded-2xl p-5 text-center relative overflow-hidden"
            style={{ background: 'linear-gradient(150deg, rgba(212,233,76,0.16), rgba(212,233,76,0.06))', border: '1px solid rgba(212,233,76,0.30)' }}>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-2" style={{ color: 'var(--lime-d)' }}>
              {t('Yetkazib berish kodi')}
            </p>
            <p className="text-glow-lime text-[40px] font-extrabold tracking-[0.18em] leading-none tabnum" style={{ color: 'var(--lime)' }}>
              {order.deliveryCode}
            </p>
            <p className="text-[12px] mt-3" style={{ color: 'var(--muted)' }}>
              {t('Yukni olayotganda kuryerga shu kodni ayting')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
