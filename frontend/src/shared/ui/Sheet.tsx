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
      {/* Backdrop — quyuq scrim */}
      <div className="absolute inset-0 animate-fade-in" style={{ background: 'rgba(5,5,7,0.6)' }} onClick={onClose} />
      {/* Sheet */}
      <div
        className="relative w-full max-w-[480px] rounded-t-[30px] border-t animate-slide-up pb-6"
        style={{ background: 'var(--card)', borderColor: 'var(--border-strong)', boxShadow: '0 -24px 60px -12px rgba(0,0,0,0.7)' }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-[38px] h-1 rounded-full" style={{ background: 'var(--border-strong)' }} />
        </div>
        {children}
      </div>
    </div>
  )
}
