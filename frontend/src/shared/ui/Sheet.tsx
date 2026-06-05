import { useEffect } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

// Pastdan chiqadigan modal (bottom sheet)
export function Sheet({ open, onClose, children }: Props) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      {/* Sheet */}
      <div className="relative w-full max-w-[480px] bg-white rounded-t-3xl shadow-[0_-8px_32px_rgba(0,0,0,0.18)] animate-slide-up pb-6">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>
        {children}
      </div>
    </div>
  )
}
