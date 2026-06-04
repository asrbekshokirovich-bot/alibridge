import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@shared/api/client';
import { LanguageSelector } from '@shared/components/LanguageSelector';
import { ActionTile, TileColor } from '@shared/components/ActionTile';

interface AdminStats {
  total_users: number;
  total_orders: number;
  total_products: number;
  open_disputes: number;
  pending_payouts: number;
  pending_payouts_amount: string;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: stats } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const { data } = await api.get<AdminStats>('/admin/stats');
      return data;
    },
  });

  const items: { icon: string; label: string; path: string; color: TileColor; badge?: number | null }[] = [
    { icon: '📦', label: t('admin.products'), path: '/admin/products', color: 'violet' },
    { icon: '📍', label: "Yo'lovchilar harakati", path: '/admin/carriers', color: 'blue' },
    { icon: '👥', label: t('admin.users'), path: '/admin/users', color: 'cyan' },
    { icon: '⚖️', label: t('admin.disputes'), path: '/admin/disputes', color: 'pink', badge: stats?.open_disputes },
    { icon: '💰', label: t('admin.payouts'), path: '/admin/payouts', color: 'amber', badge: stats?.pending_payouts },
    { icon: '💸', label: 'Qarzdorliklar', path: '/admin/debts', color: 'lime' },
  ];

  return (
    <div className="space-y-5 p-5 pb-8">
      <div className="flex items-center justify-between pt-2 animate-fade-in">
        <div>
          <p className="text-sm text-tg-hint">Salom 👋</p>
          <h1 className="text-2xl font-extrabold tracking-tight">{t('roles.admin')}</h1>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-2xl ring-1 ring-white/10">
          ⚙️
        </span>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 animate-scale-in">
          {[
            { label: t('admin.users'), value: stats.total_users, emoji: '👥', color: 'text-accent-cyan' },
            { label: t('admin.orders'), value: stats.total_orders, emoji: '📦', color: 'text-accent-violet' },
            { label: t('admin.products'), value: stats.total_products, emoji: '🏷️', color: 'text-accent-blue' },
            { label: t('admin.disputes'), value: stats.open_disputes, emoji: '⚖️', color: stats.open_disputes > 0 ? 'text-accent-pink' : 'text-accent-lime' },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3 rounded-4xl bg-tg-sectionBg p-4 shadow-card ring-1 ring-white/[0.06]">
              <span className="text-2xl">{s.emoji}</span>
              <div>
                <p className={`text-2xl font-extrabold leading-none ${s.color}`}>{s.value}</p>
                <p className="mt-1 text-[11px] text-tg-hint">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {stats && stats.pending_payouts > 0 && (
        <button
          onClick={() => navigate('/admin/payouts')}
          className="flex w-full items-center justify-between overflow-hidden rounded-4xl bg-gradient-to-br from-accent-amber to-amber-500 p-5 text-left shadow-glow-amber transition-all active:scale-[0.97]"
        >
          <div>
            <p className="text-sm font-semibold text-[#0a0a0f]/70">{t('admin.pending_payouts')}</p>
            <p className="text-2xl font-extrabold text-[#0a0a0f]">{stats.pending_payouts_amount}</p>
          </div>
          <span className="rounded-full bg-black/15 px-4 py-2 text-sm font-bold text-[#0a0a0f]">
            {t('admin.review')} ›
          </span>
        </button>
      )}

      <div>
        <p className="section-title">Boshqaruv</p>
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => (
            <ActionTile
              key={item.path}
              icon={item.icon}
              label={item.label}
              color={item.color}
              badge={item.badge}
              onClick={() => navigate(item.path)}
            />
          ))}
        </div>
      </div>

      <LanguageSelector />
    </div>
  );
}
