// Sahifa pastida qotirilgan tugma paneli
export function FixedBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100">
      {children}
    </div>
  )
}
