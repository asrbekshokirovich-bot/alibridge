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
      renderItem={(item) => (
        <>
          <p className="font-semibold text-sm text-slate-900 truncate">{item.product_name}</p>
          {item.carrier_name ? <p className="text-xs text-slate-500">{String(item.carrier_name)}</p> : null}
          <p className="text-xs font-mono text-slate-400">{item.barcode}</p>
        </>
      )}
    />
  )
}
