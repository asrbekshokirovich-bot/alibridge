import { useTranslation } from 'react-i18next'
import { DailyReport } from '@/shared/components/DailyReport'

export default function WarehouseTrDailyReport() {
  const { t } = useTranslation()
  return (
    <DailyReport
      apiUrl="/warehouse-tr/daily-in"
      queryKey="warehouse-tr-daily-in"
      subtitle={t('Turkiya ombori')}
      metricLabel={t('Keldi')}
      emptyTitle={t("Kelgan yuk yo'q")}
      emptyDesc={t('Bu kuni omborga yuk kelmagan')}
    />
  )
}
