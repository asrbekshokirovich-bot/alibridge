import { useTranslation } from 'react-i18next'
import { ScanSession } from '@/shared/ui'

export default function ReceiveFromCourier() {
  const { t } = useTranslation()
  return (
    <ScanSession
      title={t('Kuryerdan qabul')}
      subtitle={t('Barkodlarni skanlang')}
      showBack
      scanUrl="/warehouse-tr/scan-receive-courier"
      confirmUrl="/warehouse-tr/confirm-receive-courier"
      successTitle={t('Qabul qilindi!')}
      successDesc={(n) => t('{{n}} ta mahsulot omborga olindi.', { n })}
    />
  )
}
