import { ScanSession } from '@/shared/ui'

export default function HandoverCourier() {
  return (
    <ScanSession
      title="Kuryerga topshirish"
      subtitle="Toshkent kuryeri uchun"
      showBack
      scanUrl="/warehouse-uz/scan-for-courier"
      confirmUrl="/warehouse-uz/confirm-courier-handover"
      successTitle="Topshirildi!"
      successDesc={(n) => `${n} ta mahsulot kuryerga o'tdi.`}
    />
  )
}
