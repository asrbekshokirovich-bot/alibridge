import { useNavigate } from 'react-router-dom';
import { LanguageSelector } from '@shared/components/LanguageSelector';
import { ActionTile } from '@shared/components/ActionTile';
import { useChinaStats } from '@shared/api/queries';

export default function ChinaDashboard() {
  const navigate = useNavigate();
  const { data: stats } = useChinaStats();

  return (
    <div className="space-y-5 p-5 pb-8">
      <div className="flex items-center justify-between pt-2 animate-fade-in">
        <div>
          <p className="text-sm text-tg-hint">Salom 👋</p>
          <h1 className="text-2xl font-extrabold tracking-tight">Xitoy ta'minotchi</h1>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-2xl ring-1 ring-white/10">
          🇨🇳
        </span>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-3 animate-scale-in">
          {[
            { label: 'Ochiq', value: stats.open_tickets, emoji: '🛒', color: 'text-accent-amber' },
            { label: 'Tayyor', value: stats.ready_to_ship, emoji: '📦', color: 'text-accent-lime' },
            { label: "Yo'lda", value: stats.in_transit, emoji: '🚢', color: 'text-accent-blue' },
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
          <ActionTile
            icon="🛒"
            label="Sourcing vazifalar"
            desc="Sotib olish kerak"
            color="amber"
            badge={stats?.open_tickets ?? 0}
            onClick={() => navigate('/china/tickets')}
          />
          <ActionTile
            icon="📦"
            label="Mening jo'natmalarim"
            desc="Tayyor va yo'ldagi"
            color="violet"
            onClick={() => navigate('/china/shipments')}
          />
        </div>
      </div>

      <LanguageSelector />
    </div>
  );
}
