import { ScanSession } from '@/shared/ui'
import { useTranslation } from 'react-i18next'

export default function HandoverWarehouse() {
  const { t } = useTranslation()
  return (
    <ScanSession
      title={t('Omborga topshirish')}
      subtitle={t('Barkodlarni skanlang')}
      showBack
      scanUrl="/courier-tr/scan-handover-warehouse"
      confirmUrl="/courier-tr/confirm-handover-warehouse"
      successTitle={t('Topshirildi!')}
      successDesc={(n) => t('{{n}} ta mahsulot Turkiya omboriga topshirildi.', { n })}
    />
  )
}
