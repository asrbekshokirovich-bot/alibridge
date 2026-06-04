import { useQuery } from '@tanstack/react-query';
import { api } from '@shared/api/client';
import { Card } from '@shared/components/Card';

interface CarrierDetail {
  user_id: string;
  full_name: string | null;
  birth_date: string | null;
  phone: string | null;
  telegram_username: string | null;
  depart_iata: string | null;
  arrive_iata: string | null;
  depart_at: string | null;
  arrive_at: string | null;
  allowed_kg: number | null;
  flight_number: string | null;
  trust_tier: string | null;
  passport_number: string | null;
  passport_key: string | null;
  ticket_key: string | null;
  selfie_key: string | null;
}

// Maxfiy faylni auth bilan ochish (download token + openLink).
async function viewFile(key: string) {
  try {
    const { data } = await api.post<{ token: string }>('/auth/download-token');
    const url = `${window.location.origin}/api/v1/uploads/file?key=${encodeURIComponent(
      key,
    )}&token=${encodeURIComponent(data.token)}`;
    const tg = (window as unknown as { Telegram?: { WebApp?: { openLink?: (u: string) => void } } })
      .Telegram?.WebApp;
    if (tg?.openLink) tg.openLink(url);
    else window.open(url, '_blank');
  } catch {
    alert('Faylni ochishda xatolik');
  }
}

function fmtDate(s: string | null): string {
  if (!s) return '—';
  const p = s.slice(0, 10).split('-'); // YYYY-MM-DD
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : s;
}

export function CarrierDetailModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery<CarrierDetail>({
    queryKey: ['carrier-detail', userId],
    queryFn: async () => {
      const { data } = await api.get<CarrierDetail>(`/carrier/lookup/${userId}`);
      return data;
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-tg-bg p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">🪪 Yo'lovchi ma'lumotlari</h2>
        <button
          onClick={onClose}
          className="rounded-lg bg-tg-secondary-bg px-3 py-1.5 text-sm font-medium"
        >
          ✕ Yopish
        </button>
      </div>

      {isLoading || !data ? (
        <p className="text-sm text-tg-hint">Yuklanmoqda…</p>
      ) : (
        <div className="space-y-3">
          <Card>
            <Row label="👤 F.I.O" value={data.full_name || '—'} />
            <Row label="📱 Telefon" value={data.phone || '—'} />
            {data.telegram_username && <Row label="✈️ Telegram" value={'@' + data.telegram_username} />}
            <Row label="🎂 Tug'ilgan" value={fmtDate(data.birth_date)} />
            <Row label="🛫 Yo'nalish" value={`${data.depart_iata || '—'} → ${data.arrive_iata || '—'}`} />
            <Row
              label="📅 Jo'nash"
              value={data.depart_at ? new Date(data.depart_at).toLocaleString() : '—'}
            />
            {data.flight_number && <Row label="🔢 Reys" value={data.flight_number} />}
            <Row label="⚖️ Limit" value={data.allowed_kg ? `${data.allowed_kg} kg` : '—'} />
            {data.passport_number && <Row label="🪪 Passport №" value={data.passport_number} />}
          </Card>

          <div className="grid grid-cols-2 gap-2">
            {data.passport_key && (
              <button
                onClick={() => viewFile(data.passport_key!)}
                className="rounded-xl bg-tg-button px-4 py-3 text-sm font-semibold text-tg-button-text active:opacity-80"
              >
                🪪 Passport rasmi
              </button>
            )}
            {data.ticket_key && (
              <button
                onClick={() => viewFile(data.ticket_key!)}
                className="rounded-xl bg-tg-button px-4 py-3 text-sm font-semibold text-tg-button-text active:opacity-80"
              >
                🎫 Bilet rasmi
              </button>
            )}
          </div>
          {!data.passport_key && !data.ticket_key && (
            <p className="text-xs text-tg-hint">Passport/bilet rasmi yuklanmagan</p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1">
      <span className="shrink-0 text-sm text-tg-hint">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}
