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
    { role: 'carrier', label: t('Yo\'lovchi'), desc: t('Katalog, savatcha, yuklar'), path: '/carrier', icon: <IconPlane size={22} />, gradient: 'linear-gradient(135deg, #1A3A6C 0%, #16325c 100%)' },
    { role: 'warehouse_uz', label: t('Toshkent ombori'), desc: t('Yuk qabul, barkod'), path: '/warehouse-uz', icon: <IconBox size={22} />, gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' },
    { role: 'warehouse_tr', label: t('Turkiya ombori'), desc: t('Qabul, kuryer, mijoz'), path: '/warehouse-tr', icon: <IconBox size={22} />, gradient: 'linear-gradient(135deg, #132A4D 0%, #0F213D 100%)' },
    { role: 'courier_uz', label: t('Toshkent kuryeri'), desc: t('Navbat, skanlash'), path: '/courier-uz', icon: <IconTruck size={22} />, gradient: 'linear-gradient(135deg, #1A3A6C 0%, #132A4D 100%)' },
    { role: 'courier_tr', label: t('Turkiya kuryeri'), desc: t('Qabul, yetkazish'), path: '/courier-tr', icon: <IconTruck size={22} />, gradient: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)' },
    { role: 'orderer', label: t('Buyurtmachi'), desc: t('Buyurtma berish'), path: '/orderer', icon: <IconBag size={22} />, gradient: 'linear-gradient(135deg, #1A3A6C 0%, #0F213D 100%)' },
  ]

  const open = (path: string) => {
    haptic('medium')
    navigate(path)
  }

  return (
    <div className="min-h-screen px-5 py-8 animate-fade-in" style={{ background: 'var(--bg)' }}>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-[-0.02em]" style={{ color: 'var(--ink)' }}>{t('Rol sifatida ko\'rish')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{t('Admin sifatida istalgan panelni oching')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {PANELS.map((p) => (
          <button key={p.role} onClick={() => open(p.path)}
            className="press rounded-2xl p-4 border text-left flex flex-col gap-3"
            style={{ background: 'var(--surface)', borderColor: 'var(--line)', boxShadow: 'var(--shadow-md)' }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white" style={{ background: p.gradient }}>
              {p.icon}
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight" style={{ color: 'var(--ink)' }}>{p.label}</h3>
              <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--muted)' }}>{p.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
