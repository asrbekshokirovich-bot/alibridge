import { useTranslation } from 'react-i18next'
import { ScanSession } from '@/shared/ui'

export default function HandoverCourierTr() {
  const { t } = useTranslation()
  return (
    <ScanSession
      title={t('Kuryerga topshirish')}
      subtitle={t('Turkiya kuryeri uchun')}
      showBack
      scanUrl="/warehouse-tr/scan-handover"
      confirmUrl="/warehouse-tr/confirm-handover"
      successTitle={t('Topshirildi!')}
      successDesc={(n) => t('{{n}} ta mahsulot kuryerga o\'tdi.', { n })}
    />
  )
}
