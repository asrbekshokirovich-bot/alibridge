import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@shared/api/client';
import { LanguageSelector } from '@shared/components/LanguageSelector';
import { ActionTile, TileColor } from '@shared/components/ActionTile';

interface WarehouseStats {
  pending_intake: number;
  in_warehouse: number;
  dispatched_today: number;
  awaiting_pickup: number;
  pending_approvals: number;
}

export default function WarehouseUzDashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: stats } = useQuery<WarehouseStats>({
    queryKey: ['warehouse-uz-stats'],
    queryFn: async () => {
      const { data } = await api.get<WarehouseStats>('/warehouse/uz/stats');
      return data;
    },
  });

  const items: { icon: string; label: string; path: string; desc: string; color: TileColor; badge?: number }[] = [
    { icon: '📝', label: 'Yangi buyurtmalar', path: '/warehouse-uz/pending-approvals', desc: 'Tasdiqlash', color: 'pink', badge: stats?.pending_approvals || 0 },
    { icon: '⚡', label: 'Qabul qilish', path: '/warehouse-uz/quick-intake', desc: 'Nomi, soni → QR', color: 'lime' },
    { icon: '📋', label: 'Mahsulotlar', path: '/warehouse-uz/products', desc: 'Ombordagi tovarlar', color: 'violet' },
    { icon: '🏷️', label: t('warehouse.labels'), path: '/warehouse-uz/labels', desc: t('warehouse.labels_desc'), color: 'blue' },
    { icon: '🚶', label: "Kutayotgan yo'lovchilar", path: '/warehouse-uz/pending-pickups', desc: 'Savatni tasdiqlagan', color: 'amber', badge: stats?.awaiting_pickup || 0 },
    { icon: '📊', label: 'Kunlik hisobot', path: '/warehouse-uz/daily-report', desc: 'Chiqqan tovarlar', color: 'cyan' },
  ];

  return (
    <div className="space-y-5 p-5 pb-8">
      <div className="flex items-center justify-between pt-2 animate-fade-in">
        <div>
          <p className="text-sm text-tg-hint">Salom 👋</p>
          <h1 className="text-2xl font-extrabold tracking-tight">{t('roles.warehouse_uz')}</h1>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-2xl ring-1 ring-white/10">
          🏭
        </span>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-3 animate-scale-in">
          {[
            { label: t('warehouse.pending'), value: stats.pending_intake, emoji: '⏳', color: 'text-accent-amber' },
            { label: t('warehouse.in_stock'), value: stats.in_warehouse, emoji: '📦', color: 'text-accent-blue' },
            { label: t('warehouse.today'), value: stats.dispatched_today, emoji: '✈️', color: 'text-accent-lime' },
          ].map((s) => (
            <div key={s.label} className="rounded-4xl bg-tg-sectionBg p-3 text-center shadow-card ring-1 ring-white/[0.06]">
              <p className="text-xl">{s.emoji}</p>
              <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-tg-hint">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="section-title">Amallar</p>
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => (
            <ActionTile
              key={item.path}
              icon={item.icon}
              label={item.label}
              desc={item.desc}
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
