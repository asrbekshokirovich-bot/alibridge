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
      renderItem={(item) => (
        <>
          <p className="font-semibold text-sm text-slate-900 truncate">{item.product_name}</p>
          {item.carrier_number ? (
            <p className="text-xs text-slate-500">Yo'lovchi #{String(item.carrier_number)}</p>
          ) : null}
          <p className="text-xs font-mono text-slate-400">{item.barcode}</p>
        </>
      )}
    />
  )
}
