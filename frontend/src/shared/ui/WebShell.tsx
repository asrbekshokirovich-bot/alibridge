import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/shared/store/auth'
import type { Role } from '@/shared/types'
import {
  IconHome, IconBox, IconList, IconUsers, IconPlane, IconAlert,
  IconMoney, IconUser, IconTruck, IconScan, IconPackagePlus, IconHandshake,
} from '@/shared/ui/icons'

interface MenuItem {
  label: string
  path: string
  icon: React.ReactNode
}

// Har rol uchun sayt (desktop) sidebar menyusi
const MENU: Partial<Record<Role, MenuItem[]>> = {
  admin: [
    { label: 'Boshqaruv', path: '/admin', icon: <IconHome size={20} /> },
    { label: 'Xodim so\'rovlari', path: '/admin/staff-approval', icon: <IconUsers size={20} /> },
    { label: 'Xodimlar', path: '/admin/staff', icon: <IconUsers size={20} /> },
    { label: 'Yo\'lovchilar', path: '/admin/carriers', icon: <IconPlane size={20} /> },
    { label: 'Mahsulotlar', path: '/admin/products', icon: <IconBox size={20} /> },
    { label: 'Nizolar', path: '/admin/disputes', icon: <IconAlert size={20} /> },
    { label: 'To\'lovlar', path: '/admin/payments', icon: <IconMoney size={20} /> },
    { label: 'Rol sifatida ko\'rish', path: '/admin/view-as', icon: <IconUser size={20} /> },
    { label: 'Sayt logini', path: '/admin/my-credentials', icon: <IconUser size={20} /> },
  ],
  warehouse_uz: [
    { label: 'Bosh sahifa', path: '/warehouse-uz', icon: <IconHome size={20} /> },
    { label: 'Yuk qabul qilish', path: '/warehouse-uz/receive', icon: <IconPackagePlus size={20} /> },
    { label: 'Buyurtmalar', path: '/warehouse-uz/orders', icon: <IconList size={20} /> },
    { label: 'Ombordagi mahsulotlar', path: '/warehouse-uz/products', icon: <IconBox size={20} /> },
    { label: 'Barcha yuklar', path: '/warehouse-uz/all-products', icon: <IconList size={20} /> },
    { label: 'Kuryerga topshirish', path: '/warehouse-uz/handover-courier', icon: <IconTruck size={20} /> },
    { label: 'Yo\'lovchilar', path: '/warehouse-uz/carriers', icon: <IconPlane size={20} /> },
    { label: 'Nizolar', path: '/warehouse-uz/disputes', icon: <IconAlert size={20} /> },
  ],
  warehouse_tr: [
    { label: 'Bosh sahifa', path: '/warehouse-tr', icon: <IconHome size={20} /> },
    { label: 'Yo\'lovchidan qabul', path: '/warehouse-tr/receive-carrier', icon: <IconHandshake size={20} /> },
    { label: 'Kuryerga topshirish', path: '/warehouse-tr/handover-courier', icon: <IconTruck size={20} /> },
    { label: 'Eshikdan mijoz', path: '/warehouse-tr/walk-in', icon: <IconUser size={20} /> },
    { label: 'UZ mahsulotlari', path: '/warehouse-tr/uz-products', icon: <IconBox size={20} /> },
  ],
  courier_uz: [
    { label: 'Bosh sahifa', path: '/courier-uz', icon: <IconHome size={20} /> },
    { label: 'Navbat', path: '/courier-uz/queue', icon: <IconList size={20} /> },
    { label: 'Olib ketish (skan)', path: '/courier-uz/scan-pickup', icon: <IconScan size={20} /> },
    { label: 'Aeroport topshirish', path: '/courier-uz/airport-handover', icon: <IconPlane size={20} /> },
  ],
  courier_tr: [
    { label: 'Bosh sahifa', path: '/courier-tr', icon: <IconHome size={20} /> },
    { label: 'Yo\'lovchidan qabul', path: '/courier-tr/receive-from-uz', icon: <IconHandshake size={20} /> },
    { label: 'Omborga topshirish', path: '/courier-tr/handover-warehouse', icon: <IconTruck size={20} /> },
  ],
}

const ROLE_TITLE: Partial<Record<Role, string>> = {
  admin: 'Administrator',
  warehouse_uz: 'Toshkent ombori',
  warehouse_tr: 'Turkiya ombori',
  courier_uz: 'Toshkent kuryeri',
  courier_tr: 'Turkiya kuryeri',
}

/**
 * Sayt (brauzer) qobig'i — chap sidebar + kontent.
 * Faqat desktopda (CSS .web @media >=1024px) sidebar ko'rinadi;
 * telefon brauzerda sidebar yashirin, kontent to'liq enga ega.
 */
export function WebShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const items = (user && MENU[user.role]) || []

  const logout = () => {
    clearAuth()
    localStorage.removeItem('carrier_ticket')
    navigate('/web-login', { replace: true })
  }

  return (
    <div className="web-shell">
      {/* Sidebar — desktopda CSS bilan ko'rinadi */}
      <aside className="web-sidebar hidden lg:flex flex-col">
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--brand-gradient)' }}>
              <IconPlane size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-slate-900 leading-tight">Ali Bridge</p>
              <p className="text-[11px] text-slate-400 truncate">{user ? ROLE_TITLE[user.role] ?? user.role : ''}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const active = location.pathname === item.path
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`press w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-colors ${
                  active ? 'text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
                style={active ? { background: 'var(--brand-gradient)' } : undefined}
              >
                <span className={active ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="px-3 py-4 border-t border-slate-100">
          <div className="px-3 mb-2">
            <p className="text-sm font-semibold text-slate-700 truncate">{user?.first_name} {user?.last_name}</p>
            {user?.username && <p className="text-[11px] text-slate-400 truncate">@{user.username}</p>}
          </div>
          <button
            onClick={logout}
            className="press w-full px-3 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-600 text-left"
          >
            Chiqish
          </button>
        </div>
      </aside>

      {/* Kontent */}
      <main className="web-content">{children}</main>
    </div>
  )
}
