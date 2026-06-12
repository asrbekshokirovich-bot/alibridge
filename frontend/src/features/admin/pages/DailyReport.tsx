import { DailyReport } from '@/shared/components/DailyReport'

export default function AdminDailyReport() {
  return (
    <DailyReport
      apiUrl="/admin/daily-out"
      queryKey="admin-daily-out"
      subtitle="Barcha omborlar"
    />
  )
}
