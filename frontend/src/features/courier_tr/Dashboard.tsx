import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTelegram } from '@/shared/hooks/useTelegram'
import { useAuthStore } from '@/shared/store/auth'
import { DashboardHeader, IconBox, IconHandshake, IconBag } from '@/shared/ui'

export default function CourierTrDashboard() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { haptic } = useTelegram()
  const user = useAuthStore((s) => s.user)

  const actions = [
    { label: t('Yo\'lovchidan yuk qabul qilish'), desc: t('Barkodni skanlab qabul qilish'), path: '/courier-tr/receive-from-uz', icon: <IconBox size={26} />, gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' },
    { label: t('Mendagi yuklar'), desc: t('Hozir sizda turgan yuklar'), path: '/courier-tr/my-products', icon: <IconBag size={26} />, gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' },
    { label: t('Yukni omborga topshirish'), desc: t('Turkiya omboriga topshirish'), path: '/courier-tr/handover-warehouse', icon: <IconHandshake size={26} />, gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
  ]

  return (
    <div className="min-h-screen animate-fade-in">
      <DashboardHeader role={t('Turkiya kuryeri')} name={user?.first_name} />
      <div className="px-4 pt-6 space-y-4">
        {actions.map((a) => (
          <button key={a.path}
            onClick={() => { haptic('light'); navigate(a.path) }}
            className="press w-full bg-white rounded-3xl p-5 border border-slate-100 shadow-[var(--shadow-md)] text-left">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white mb-3" style={{ background: a.gradient }}>
              {a.icon}
            </div>
            <h3 className="font-bold text-slate-900 text-base">{a.label}</h3>
            <p className="text-sm text-slate-400 mt-0.5">{a.desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
