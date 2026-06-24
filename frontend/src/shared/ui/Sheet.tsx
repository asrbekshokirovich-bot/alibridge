import { useEffect } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

/**
 * v2 (redesign): to'qroq backdrop + kuchli yuqoriga soya, gradient yuza,
 * aniqroq tepa chegara. animate-slide-up endi yumshoqroq easing bilan.
 */
export function Sheet({ open, onClose, children }: Props) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 animate-fade-in" style={{ background: 'rgba(4,8,18,0.58)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }} onClick={onClose} />
      {/* Sheet */}
      <div
        className="relative w-full max-w-[480px] rounded-t-3xl animate-slide-up pb-6 border-t"
        style={{
          background: 'linear-gradient(180deg, #101a30 0%, #0b1426 100%)',
          borderColor: 'var(--line2)',
          boxShadow: '0 -20px 50px -16px rgba(0,0,0,0.8)',
        }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--line2)' }} />
        </div>
        {children}
      </div>
    </div>
  )
}
