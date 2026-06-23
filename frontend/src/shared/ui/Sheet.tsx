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
      <div className="absolute inset-0 animate-fade-in" style={{ background: 'rgba(10,26,52,0.46)', backdropFilter: 'blur(3px)' }} onClick={onClose} />
      {/* Sheet */}
      <div
        className="relative w-full max-w-[480px] rounded-t-3xl animate-slide-up pb-6 border-t"
        style={{ background: 'var(--surface)', borderColor: 'var(--line)', boxShadow: '0 -18px 50px rgba(10,26,52,0.22)' }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--line2)' }} />
        </div>
        {children}
      </div>
    </div>
  )
}
