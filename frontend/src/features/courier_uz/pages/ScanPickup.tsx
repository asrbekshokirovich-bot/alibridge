import { ScanSession } from '@/shared/ui'

export default function ScanPickup() {
  return (
    <ScanSession
      title="Ombordan olish"
      subtitle="Barkodlarni skanlang"
      showBack
      scanUrl="/courier-uz/scan-pickup"
      confirmUrl="/courier-uz/confirm-pickup"
      successTitle="Mahsulotlar sizda!"
      successDesc={(n) => `${n} ta mahsulot qabul qilindi.`}
    />
  )
}
