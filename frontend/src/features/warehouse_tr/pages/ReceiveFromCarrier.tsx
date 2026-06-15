import { useTranslation } from 'react-i18next'
import { ScanSession } from '@/shared/ui'

export default function ReceiveFromCarrier() {
  const { t } = useTranslation()
  return (
    <ScanSession
      title={t("Yo'lovchidan qabul")}
      subtitle={t('Barkodlarni skanlang')}
      showBack
      scanUrl="/warehouse-tr/scan-receive"
      confirmUrl="/warehouse-tr/confirm-receive"
      successTitle={t('Qabul qilindi!')}
      successDesc={(n) => t('{{n}} ta mahsulot omborga olindi.', { n })}
    />
  )
}
