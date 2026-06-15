import { useTranslation } from 'react-i18next'
import { DailyReport } from '@/shared/components/DailyReport'

export default function WarehouseUzDailyReport() {
  const { t } = useTranslation()
  return (
    <DailyReport
      apiUrl="/warehouse-uz/daily-out"
      queryKey="warehouse-uz-daily-out"
      subtitle={t('Toshkent ombori')}
    />
  )
}
