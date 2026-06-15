import { useTranslation } from 'react-i18next'
import { ScanSession } from '@/shared/ui'

export default function ScanPickup() {
  const { t } = useTranslation()
  return (
    <ScanSession
      title={t('Buyurtmadan tashqari qabul')}
      subtitle={t('Istalgan yukni skanlang')}
      showBack
      scanUrl="/courier-uz/scan-pickup"
      confirmUrl="/courier-uz/confirm-pickup"
      successTitle={t('Mahsulotlar sizda!')}
      successDesc={(n) => t('{{n}} ta mahsulot qabul qilindi.', { n })}
    />
  )
}
