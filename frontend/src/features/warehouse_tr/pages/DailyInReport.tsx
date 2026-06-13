import { DailyReport } from '@/shared/components/DailyReport'

export default function WarehouseTrDailyReport() {
  return (
    <DailyReport
      apiUrl="/warehouse-tr/daily-in"
      queryKey="warehouse-tr-daily-in"
      subtitle="Turkiya ombori"
      metricLabel="Keldi"
      emptyTitle="Kelgan yuk yo'q"
      emptyDesc="Bu kuni omborga yuk kelmagan"
    />
  )
}
