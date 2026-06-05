import { useNavigate } from 'react-router-dom'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { IconBag, IconPlane, IconUsers } from '@/shared/ui'

export default function Welcome() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()

  const go = (path: string) => { haptic('medium'); navigate(path) }

  const options = [
    {
      title: 'Buyurtma berish',
      desc: 'Mahsulot buyurtma qiling',
      icon: <IconBag size={26} />,
      path: '/orderer/register',
      gradient: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
    },
    {
      title: 'Turkiyaga yuk olib ketish',
      desc: 'Yo\'lovchi sifatida pul ishlang',
      icon: <IconPlane size={26} />,
      path: '/carrier/register',
      gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    },
    {
      title: 'Kompaniya xodimi',
      desc: 'Jamoa a\'zosi sifatida kirish',
      icon: <IconUsers size={26} />,
      path: '/staff/register',
      gradient: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
    },
  ]

  return (
    <div className="min-h-screen flex flex-col px-6 animate-fade-in">
      {/* Logo / Hero */}
      <div className="pt-16 pb-10 text-center">
        <div
          className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-5 shadow-[var(--shadow-brand)]"
          style={{ background: 'var(--brand-gradient)' }}
        >
          <IconPlane size={38} className="text-white" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">ALI BRIDGE</h1>
        <p className="text-sm text-slate-500 mt-1.5">Toshkent → Turkiya kargo tizimi</p>
      </div>

      {/* Tanlovlar */}
      <div className="flex flex-col gap-3.5 flex-1">
        {options.map((opt) => (
          <button
            key={opt.path}
            onClick={() => go(opt.path)}
            className="press bg-white rounded-3xl p-4 border border-slate-100 shadow-[var(--shadow-md)] flex items-center gap-4 text-left"
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0"
              style={{ background: opt.gradient }}
            >
              {opt.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-900 text-[15px]">{opt.title}</h3>
              <p className="text-[13px] text-slate-500">{opt.desc}</p>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-slate-300 shrink-0">
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-slate-400 py-6">ALI BRIDGE © 2026</p>
    </div>
  )
}
