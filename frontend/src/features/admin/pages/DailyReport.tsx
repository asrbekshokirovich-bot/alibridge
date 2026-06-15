import { useTranslation } from 'react-i18next'
import { DailyReport } from '@/shared/components/DailyReport'

export default function AdminDailyReport() {
  const { t } = useTranslation()
  return (
    <DailyReport
      apiUrl="/admin/daily-out"
      queryKey="admin-daily-out"
      subtitle={t('Barcha omborlar')}
    />
  )
}
