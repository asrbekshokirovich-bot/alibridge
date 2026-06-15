import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGS, setLang, getLang, type LangCode } from '@/shared/i18n'
import { useTelegram } from '@/shared/hooks/useTelegram'

// Til almashtirgich — dashboard header'ning o'ng burchagida.
// Bayroq tugmasi bosilganda til ro'yxati ochiladi.
export function LangSwitcher({ dark = true }: { dark?: boolean }) {
  const { i18n } = useTranslation()
  const { haptic } = useTelegram()
  const [open, setOpen] = useState(false)
  const current = LANGS.find((l) => l.code === getLang()) ?? LANGS[0]

  const choose = (code: LangCode) => {
    haptic('light')
    setLang(code)
    setOpen(false)
  }

  // i18n.language o'qiladi — til o'zgarsa qayta render bo'ladi
  void i18n.language

  return (
    <>
      <button
        onClick={() => { haptic('light'); setOpen(true) }}
        className={`press flex items-center gap-1.5 px-2.5 h-9 rounded-full text-sm font-semibold ${
          dark ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'
        }`}
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className="uppercase text-xs tracking-wide">{current.code}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade-in"
          onClick={() => setOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-t-3xl p-4 pb-7 animate-slide-up"
            onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-4" />
            <div className="space-y-1.5">
              {LANGS.map((l) => (
                <button key={l.code}
                  onClick={() => choose(l.code)}
                  className={`press w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left ${
                    l.code === current.code ? 'bg-slate-100' : ''
                  }`}>
                  <span className="text-2xl">{l.flag}</span>
                  <span className="flex-1 font-semibold text-slate-900">{l.label}</span>
                  {l.code === current.code && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--brand)' }}>
                      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
