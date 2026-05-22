/**
 * Xitoy xodimi uchun sotib olish talonlari (sourcing tickets).
 * INVARIANT 2: Bu view'da orderer_id va customer_paid ko'rinmaydi — faqat mahsulot spesifikatsiyasi.
 */
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api, extractErrorMessage } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { EmptyState } from '@shared/components/EmptyState';
import { useBackButton } from '@shared/hooks/useTelegram';
import { LanguageSelector } from '@shared/components/LanguageSelector';

// Invariant 2: orderer_id va customer_paid yo'q
interface SourcingTicket {
  id: string;
  ticket_number: string;
  spec_title: string;
  spec_photos: string[];
  quantity_needed: number;
  quantity_sourced: number;
  target_unit_price_cny: string;
  notes: string | null;
  status: 'OPEN' | 'SOURCING' | 'READY' | 'DONE';
  deadline: string | null;
}

const STATUS_LABELS: Record<SourcingTicket['status'], { emoji: string; color: string }> = {
  OPEN: { emoji: '🔵', color: 'text-blue-500' },
  SOURCING: { emoji: '🟡', color: 'text-yellow-500' },
  READY: { emoji: '🟢', color: 'text-green-500' },
  DONE: { emoji: '⚫', color: 'text-tg-hint' },
};

export default function ChinaTicketList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useBackButton(() => navigate(-1));

  const { data, isLoading, error } = useQuery<SourcingTicket[]>({
    queryKey: ['china-tickets'],
    queryFn: async () => {
      const { data } = await api.get<SourcingTicket[]>('/china/tickets');
      return data;
    },
  });

  if (isLoading) return <LoadingScreen />;

  if (error) {
    return (
      <div className="p-4">
        <EmptyState icon="⚠️" title={t('common.error')} description={extractErrorMessage(error)} />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-4">
        <EmptyState icon="🛍️" title={t('china.no_tickets')} />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 pb-20">
      <h1 className="px-1 text-xl font-bold">{t('roles.china_worker')}</h1>
      <LanguageSelector />

      {data.map((ticket) => {
        const statusMeta = STATUS_LABELS[ticket.status];
        return (
          <Card key={ticket.id}>
            {/* Rasm */}
            {ticket.spec_photos[0] && (
              <img
                src={ticket.spec_photos[0]}
                alt={ticket.spec_title}
                className="mb-2 h-36 w-full rounded-lg object-cover"
              />
            )}

            {/* Sarlavha va holat */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-semibold">{ticket.spec_title}</p>
                <p className="font-mono text-xs text-tg-hint">{ticket.ticket_number}</p>
              </div>
              <span className={`text-xs font-bold ${statusMeta.color}`}>
                {statusMeta.emoji} {ticket.status}
              </span>
            </div>

            {/* Miqdor va narx */}
            <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <div className="text-center">
                <p className="text-xs text-tg-hint">{t('china.needed')}</p>
                <p className="font-bold">{ticket.quantity_needed}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-tg-hint">{t('china.sourced')}</p>
                <p className={`font-bold ${ticket.quantity_sourced >= ticket.quantity_needed ? 'text-green-500' : 'text-yellow-500'}`}>
                  {ticket.quantity_sourced}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-tg-hint">{t('china.price_cny')}</p>
                <p className="font-bold">¥{ticket.target_unit_price_cny}</p>
              </div>
            </div>

            {/* Izoh */}
            {ticket.notes && (
              <p className="mt-2 rounded bg-tg-secondary-bg px-2 py-1 text-xs text-tg-hint">
                📝 {ticket.notes}
              </p>
            )}

            {/* Muddat */}
            {ticket.deadline && (
              <p className="mt-1 text-xs text-tg-hint">
                ⏰ {new Date(ticket.deadline).toLocaleDateString()}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
