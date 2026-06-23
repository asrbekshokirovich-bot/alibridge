// Sahifa pastida qotirilgan tugma paneli.
// Telegram/telefon: ekran pastida fixed (480px markazda).
// Desktop sayt (.web >=1024px): kontent pastida sticky, to'liq enga.
export function FixedBar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="tg-fixedbar fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 backdrop-blur-xl border-t"
      style={{ background: 'rgba(11,11,14,0.82)', borderColor: 'var(--border-soft)' }}
    >
      {children}
    </div>
  )
}
