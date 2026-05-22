import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { LanguageSelector } from '@shared/components/LanguageSelector';

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

  const items = [
    { icon: '📦', label: t('admin.products'), path: '/admin/products', badge: null },
    { icon: '👥', label: t('admin.users'),    path: '/admin/users',    badge: null },
    { icon: '⚖️', label: t('admin.disputes'), path: '/admin/disputes', badge: stats?.open_disputes },
    { icon: '💰', label: t('admin.payouts'),  path: '/admin/payouts',  badge: stats?.pending_payouts },
  ];

  return (
    <div className="space-y-3 p-4">
      <h1 className="px-1 text-xl font-bold">{t('roles.admin')}</h1>

      {/* Asosiy statistika */}
      {stats && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: t('admin.users'), value: stats.total_users, emoji: '👥' },
            { label: t('admin.orders'), value: stats.total_orders, emoji: '📦' },
            { label: t('admin.products'), value: stats.total_products, emoji: '🏷️' },
            { label: t('admin.disputes'), value: stats.open_disputes, emoji: '⚖️', urgent: stats.open_disputes > 0 },
          ].map((stat) => (
            <Card key={stat.label} className="text-center">
              <p className="text-2xl">{stat.emoji}</p>
              <p className={`text-2xl font-bold ${stat.urgent ? 'text-red-500' : ''}`}>
                {stat.value}
              </p>
              <p className="text-xs text-tg-hint">{stat.label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* To'lovlar summasi */}
      {stats && stats.pending_payouts > 0 && (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-tg-hint">{t('admin.pending_payouts')}</p>
              <p className="text-lg font-bold">{stats.pending_payouts_amount}</p>
            </div>
            <Button onClick={() => navigate('/admin/payouts')}>
              {t('admin.review')}
            </Button>
          </div>
        </Card>
      )}

      {/* Menyu */}
      {items.map((item) => (
        <Card
          key={item.path}
          className="cursor-pointer active:scale-95"
          onClick={() => navigate(item.path)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </div>
            {item.badge != null && item.badge > 0 && (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                {item.badge}
              </span>
            )}
          </div>
        </Card>
      ))}

      <LanguageSelector />
    </div>
  );
}

// Local Button (import qilmasdan inline ishlatish uchun)
function Button({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg bg-tg-button px-3 py-1.5 text-sm font-medium text-tg-button-text"
    >
      {children}
    </button>
  );
}
