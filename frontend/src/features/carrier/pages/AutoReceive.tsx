import { Header, IconHandshake } from '@/shared/ui'
import { useAuthStore } from '@/shared/store/auth'
import { useTranslation } from 'react-i18next'

export default function AutoReceive() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const carrierNumber = user?.carrier_number

  return (
    <div className="min-h-screen pb-28 animate-fade-in">
      <Header title={t('Kuryerdan qabul')} subtitle={t("Raqamingizni kuryerga ko'rsating")} />

      {/* Info banner */}
      <div className="px-4 pt-4">
        <div className="rounded-2xl p-4 flex gap-3" style={{ background: 'var(--brand-gradient-soft)' }}>
          <div className="text-red-500 shrink-0"><IconHandshake size={22} /></div>
          <p className="text-[13px] text-red-900/80 leading-snug">
            {t('Aeroportда kuryerga quyidagi raqamingizni ayting. Kuryer barkodlarni skanlab, yuklaringizni sizga topshiradi.')}
          </p>
        </div>
      </div>

      {/* Yo'lovchi raqami — katta ko'rinishda */}
      <div className="px-4 pt-8 flex flex-col items-center">
        {carrierNumber ? (
          <>
            <p className="text-sm text-slate-500 mb-2">{t("Sizning yo'lovchi raqamingiz")}</p>
            <div
              className="w-40 h-40 rounded-[2rem] flex items-center justify-center text-white shadow-[var(--shadow-brand)]"
              style={{ background: 'var(--brand-gradient)' }}
            >
              <span className="text-6xl font-extrabold tracking-tight">#{carrierNumber}</span>
            </div>
            <p className="text-[13px] text-slate-400 mt-5 text-center max-w-[260px]">
              {t('Kuryer bu raqamni kiritib, yuklaringizni skanlaydi — yuklar avtomatik')}
              <span className="font-semibold text-slate-500"> {t('«Yuklarim»')}</span> {t("bo'limiga o'tadi.")}
            </p>
          </>
        ) : (
          <p className="text-slate-500 text-sm text-center mt-10">
            {t("Yo'lovchi raqamingiz hali tayinlanmagan. Iltimos, qaytadan kiring.")}
          </p>
        )}
      </div>
    </div>
  )
}
