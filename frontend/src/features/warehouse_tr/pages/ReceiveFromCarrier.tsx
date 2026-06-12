import { ScanSession } from '@/shared/ui'

export default function ReceiveFromCarrier() {
  return (
    <ScanSession
      title="Yo'lovchidan qabul"
      subtitle="Barkodlarni skanlang"
      showBack
      scanUrl="/warehouse-tr/scan-receive"
      confirmUrl="/warehouse-tr/confirm-receive"
      successTitle="Qabul qilindi!"
      successDesc={(n) => `${n} ta mahsulot omborga olindi.`}
    />
  )
}
