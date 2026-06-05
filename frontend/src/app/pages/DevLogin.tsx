import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/shared/store/auth'
import type { Role, User } from '@/shared/types'
import { IconBox, IconTruck, IconPlane, IconUser, IconUsers } from '@/shared/ui'

const ROLES: { role: Role; label: string; desc: string; path: string; icon: React.ReactNode; gradient: string }[] = [
  { role: 'carrier', label: 'Yo\'lovchi', desc: 'Katalog, savatcha, yuklar', path: '/carrier', icon: <IconPlane size={24} />, gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' },
  { role: 'warehouse_uz', label: 'Toshkent ombori', desc: 'Yuk qabul, barkod', path: '/warehouse-uz', icon: <IconBox size={24} />, gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
  { role: 'warehouse_tr', label: 'Turkiya ombori', desc: 'Qabul, kuryer, mijoz', path: '/warehouse-tr', icon: <IconBox size={24} />, gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' },
  { role: 'courier_uz', label: 'Toshkent kuryeri', desc: 'Navbat, skanlash', path: '/courier-uz', icon: <IconTruck size={24} />, gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' },
  { role: 'courier_tr', label: 'Turkiya kuryeri', desc: 'Qabul, yetkazish', path: '/courier-tr', icon: <IconTruck size={24} />, gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
  { role: 'admin', label: 'Admin', desc: 'To\'liq boshqaruv', path: '/admin', icon: <IconUser size={24} />, gradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' },
]

// Onboarding (login'siz) ekranlar
const FLOWS: { label: string; path: string }[] = [
  { label: 'Boshlang\'ich ekran (Welcome)', path: '/welcome' },
  { label: 'Yo\'lovchi ro\'yxat', path: '/carrier/register' },
  { label: 'Xodim ro\'yxat', path: '/staff/register' },
  { label: 'Xodim kutish ekrani', path: '/staff/pending' },
]

export default function DevLogin() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const loginAs = (role: Role, path: string) => {
    const mockUser: User = {
      id: 1, telegram_id: 123456, first_name: 'Test', last_name: 'User',
      phone: '+998901234567', role,
      carrier_number: role === 'carrier' ? 47 : undefined,
      is_active: true,
    }
    setAuth('dev-token', mockUser)
    navigate(path)
  }

  const reset = () => {
    localStorage.clear()
    window.location.reload()
  }

  return (
    <div className="min-h-screen px-5 py-8 animate-fade-in">
      <div className="text-center mb-7">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold mb-3">
          🛠 TEST REJIM — barcha dostup ochiq
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">Rol tanlang</h1>
        <p className="text-sm text-slate-500 mt-1">Istalgan panelni to'g'ridan-to'g'ri oching</p>
      </div>

      {/* Rollar */}
      <div className="grid grid-cols-2 gap-3">
        {ROLES.map((r) => (
          <button key={r.role} onClick={() => loginAs(r.role, r.path)}
            className="press bg-white rounded-3xl p-4 border border-slate-100 shadow-[var(--shadow-md)] text-left flex flex-col gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white" style={{ background: r.gradient }}>
              {r.icon}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm leading-tight">{r.label}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{r.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Onboarding ekranlar */}
      <div className="mt-7">
        <div className="flex items-center gap-2 mb-3">
          <IconUsers size={18} className="text-slate-400" />
          <h2 className="text-sm font-bold text-slate-700">Onboarding ekranlar</h2>
        </div>
        <div className="space-y-2">
          {FLOWS.map((f) => (
            <button key={f.path} onClick={() => navigate(f.path)}
              className="press w-full bg-white rounded-2xl px-4 py-3 border border-slate-100 shadow-sm text-left text-sm font-medium text-slate-700 flex items-center justify-between">
              {f.label}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-slate-300">
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Reset */}
      <button onClick={reset}
        className="press w-full mt-7 py-3 bg-red-50 text-red-600 rounded-2xl text-sm font-semibold">
        🗑 Hammasini tozalash (localStorage)
      </button>
    </div>
  )
}
