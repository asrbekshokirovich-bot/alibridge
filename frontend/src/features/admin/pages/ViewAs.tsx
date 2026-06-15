import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTelegram } from '@/shared/hooks/useTelegram'
import type { Role } from '@/shared/types'
import { IconBox, IconTruck, IconPlane, IconBag } from '@/shared/ui'

export default function ViewAs() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { haptic } = useTelegram()

  // Admin ko'ra oladigan panellar
  const PANELS: { role: Role; label: string; desc: string; path: string; icon: React.ReactNode; gradient: string }[] = [
    { role: 'carrier', label: t('Yo\'lovchi'), desc: t('Katalog, savatcha, yuklar'), path: '/carrier', icon: <IconPlane size={22} />, gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' },
    { role: 'warehouse_uz', label: t('Toshkent ombori'), desc: t('Yuk qabul, barkod'), path: '/warehouse-uz', icon: <IconBox size={22} />, gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
    { role: 'warehouse_tr', label: t('Turkiya ombori'), desc: t('Qabul, kuryer, mijoz'), path: '/warehouse-tr', icon: <IconBox size={22} />, gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' },
    { role: 'courier_uz', label: t('Toshkent kuryeri'), desc: t('Navbat, skanlash'), path: '/courier-uz', icon: <IconTruck size={22} />, gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' },
    { role: 'courier_tr', label: t('Turkiya kuryeri'), desc: t('Qabul, yetkazish'), path: '/courier-tr', icon: <IconTruck size={22} />, gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
    { role: 'orderer', label: t('Buyurtmachi'), desc: t('Buyurtma berish'), path: '/orderer', icon: <IconBag size={22} />, gradient: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)' },
  ]

  const open = (path: string) => {
    haptic('medium')
    navigate(path)
  }

  return (
    <div className="min-h-screen px-5 py-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">{t('Rol sifatida ko\'rish')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('Admin sifatida istalgan panelni oching')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {PANELS.map((p) => (
          <button key={p.role} onClick={() => open(p.path)}
            className="press bg-white rounded-3xl p-4 border border-slate-100 shadow-[var(--shadow-md)] text-left flex flex-col gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white" style={{ background: p.gradient }}>
              {p.icon}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm leading-tight">{p.label}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{p.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
