import { ScanSession } from '@/shared/ui'

export default function HandoverCourierTr() {
  return (
    <ScanSession
      title="Kuryerga topshirish"
      subtitle="Turkiya kuryeri uchun"
      showBack
      scanUrl="/warehouse-tr/scan-handover"
      confirmUrl="/warehouse-tr/confirm-handover"
      successTitle="Topshirildi!"
      successDesc={(n) => `${n} ta mahsulot kuryerga o'tdi.`}
    />
  )
}
