import { DailyReport } from '@/shared/components/DailyReport'

export default function WarehouseUzDailyReport() {
  return (
    <DailyReport
      apiUrl="/warehouse-uz/daily-out"
      queryKey="warehouse-uz-daily-out"
      subtitle="Toshkent ombori"
    />
  )
}
