import { ScanSession } from '@/shared/ui'

export default function HandoverCarrier() {
  return (
    <ScanSession
      title="Yo'lovchiga topshirish"
      subtitle="Barkodlarni skanlang"
      showBack
      scanUrl="/warehouse-uz/scan-for-carrier"
      confirmUrl="/warehouse-uz/confirm-carrier-handover"
      successTitle="Topshirildi!"
      successDesc={(n) => `${n} ta mahsulot yo'lovchiga o'tdi.`}
      renderItem={(item) => (
        <>
          <p className="font-semibold text-sm text-slate-900 truncate">{item.product_name}</p>
          {item.carrier_number ? (
            <p className="text-xs text-slate-500">
              Yo'lovchi #{String(item.carrier_number)} — {String(item.carrier_name ?? '')}
            </p>
          ) : null}
          <p className="text-xs font-mono text-slate-400">{item.barcode}</p>
        </>
      )}
    />
  )
}
