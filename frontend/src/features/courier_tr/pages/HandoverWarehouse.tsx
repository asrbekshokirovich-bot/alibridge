import { ScanSession } from '@/shared/ui'

export default function HandoverWarehouse() {
  return (
    <ScanSession
      title="Omborga topshirish"
      subtitle="Barkodlarni skanlang"
      showBack
      scanUrl="/courier-tr/scan-handover-warehouse"
      confirmUrl="/courier-tr/confirm-handover-warehouse"
      successTitle="Topshirildi!"
      successDesc={(n) => `${n} ta mahsulot Turkiya omboriga topshirildi.`}
    />
  )
}
