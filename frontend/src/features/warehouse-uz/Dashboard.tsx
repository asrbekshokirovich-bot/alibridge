import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { LanguageSelector } from '@shared/components/LanguageSelector';

interface WarehouseStats {
  pending_intake: number;
  in_warehouse: number;
  dispatched_today: number;
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

  const items = [
    { icon: '⚡', label: 'Tezkor qabul', path: '/warehouse-uz/quick-intake', desc: 'Nomi, soni, og\'irlik → QR kod' },
    { icon: '📥', label: t('warehouse.intake'), path: '/warehouse-uz/intake', desc: t('warehouse.intake_desc') },
    { icon: '📷', label: t('warehouse.scan'), path: '/warehouse-uz/scan', desc: t('warehouse.scan_desc') },
    { icon: '🏷️', label: t('warehouse.labels'), path: '/warehouse-uz/labels', desc: t('warehouse.labels_desc') },
  ];

  return (
    <div className="space-y-3 p-4">
      <h1 className="px-1 text-xl font-bold">{t('roles.warehouse_uz')}</h1>

      {/* Statistika */}
      {stats && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t('warehouse.pending'), value: stats.pending_intake, emoji: '⏳' },
            { label: t('warehouse.in_stock'), value: stats.in_warehouse, emoji: '📦' },
            { label: t('warehouse.today'), value: stats.dispatched_today, emoji: '✈️' },
          ].map((stat) => (
            <Card key={stat.label} className="text-center">
              <p className="text-xl">{stat.emoji}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-tg-hint">{stat.label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Menyu */}
      {items.map((item) => (
        <Card
          key={item.path}
          className="cursor-pointer active:scale-95"
          onClick={() => navigate(item.path)}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{item.icon}</span>
            <div>
              <p className="font-medium">{item.label}</p>
              <p className="text-xs text-tg-hint">{item.desc}</p>
            </div>
          </div>
        </Card>
      ))}

      <LanguageSelector />
    </div>
  );
}
