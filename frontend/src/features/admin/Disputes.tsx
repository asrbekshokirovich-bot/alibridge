import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api, extractErrorMessage } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { EmptyState } from '@shared/components/EmptyState';
import { useBackButton, haptic } from '@shared/hooks/useTelegram';

interface DisputeItem {
  id: string;
  dispute_type: string;
  status: string;
  product_short_code: string;
  carrier_name: string;
  filed_by_name: string;
  filed_at: string;
  description: string;
  deduction_amount: string | null;
  deduction_currency: string | null;
}

interface ResolvePayload {
  resolution: 'CARRIER_FAULT' | 'FORCE_MAJEURE' | 'ORDERER_FAULT' | 'SPLIT';
  deduction_amount?: string;
  notes?: string;
}

export default function AdminDisputes() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<DisputeItem | null>(null);
  const [resolution, setResolution] = useState<ResolvePayload['resolution']>('FORCE_MAJEURE');
  const [deduction, setDeduction] = useState('');
  const [notes, setNotes] = useState('');

  useBackButton(() => {
    if (selected) {
      setSelected(null);
    } else {
      navigate(-1);
    }
  });

  const { data, isLoading } = useQuery<DisputeItem[]>({
    queryKey: ['admin-disputes'],
    queryFn: async () => {
      const { data } = await api.get<DisputeItem[]>('/admin/disputes?status=OPEN');
      return data;
    },
    enabled: !selected,
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: ResolvePayload }) => {
      await api.post(`/admin/disputes/${id}/resolve`, payload);
    },
    onSuccess: () => {
      haptic('success');
      queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
      setSelected(null);
    },
    onError: (error) => {
      haptic('error');
      alert(extractErrorMessage(error));
    },
  });

  if (isLoading && !selected) return <LoadingScreen />;

  // Hal qilish formasi
  if (selected) {
    return (
      <div className="space-y-3 p-4 pb-24">
        <Card>
          <h3 className="font-bold">{selected.dispute_type}</h3>
          <p className="text-sm">📦 {selected.product_short_code}</p>
          <p className="text-sm">👤 {selected.carrier_name}</p>
          <p className="mt-2 text-sm text-tg-hint">{selected.description}</p>
          <p className="text-xs text-tg-hint">
            {new Date(selected.filed_at).toLocaleString()}
          </p>
        </Card>

        {/* Qaror tanlash */}
        <Card>
          <p className="mb-2 text-sm font-medium">{t('admin.resolution')}</p>
          <div className="space-y-2">
            {(['CARRIER_FAULT', 'FORCE_MAJEURE', 'ORDERER_FAULT', 'SPLIT'] as const).map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="resolution"
                  value={r}
                  checked={resolution === r}
                  onChange={() => setResolution(r)}
                  className="accent-tg-button"
                />
                <span>{r.replace('_', ' ')}</span>
              </label>
            ))}
          </div>
        </Card>

        {/* Ushlab qolish summasi */}
        {(resolution === 'CARRIER_FAULT' || resolution === 'SPLIT') && (
          <Card>
            <label className="mb-1 block text-sm font-medium">{t('admin.deduction_amount')}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={deduction}
              onChange={(e) => setDeduction(e.target.value)}
              placeholder="0.00 USD"
              className="w-full rounded-lg border border-tg-secondary-bg bg-tg-secondary-bg px-3 py-2 text-sm text-tg-text outline-none focus:border-tg-button"
            />
          </Card>
        )}

        <Card>
          <label className="mb-1 block text-sm font-medium">{t('admin.notes')}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-tg-secondary-bg bg-tg-secondary-bg px-3 py-2 text-sm text-tg-text outline-none focus:border-tg-button"
          />
        </Card>

        <Button
          fullWidth
          size="lg"
          loading={resolveMutation.isPending}
          onClick={() => {
            resolveMutation.mutate({
              id: selected.id,
              payload: {
                resolution,
                deduction_amount: deduction || undefined,
                notes: notes || undefined,
              },
            });
          }}
        >
          ⚖️ {t('admin.resolve')}
        </Button>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-4">
        <EmptyState icon="✅" title={t('admin.no_disputes')} />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 pb-20">
      <h2 className="px-1 text-lg font-bold">
        {t('admin.disputes')} ({data.length})
      </h2>

      {data.map((dispute) => (
        <Card
          key={dispute.id}
          className="cursor-pointer active:scale-95"
          onClick={() => setSelected(dispute)}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold">{dispute.dispute_type}</p>
              <p className="text-sm">
                📦 {dispute.product_short_code} · 👤 {dispute.carrier_name}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-tg-hint">{dispute.description}</p>
            </div>
            <span className="ml-2 flex-shrink-0 rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
              {dispute.status}
            </span>
          </div>
          <p className="mt-2 text-xs text-tg-hint">
            {new Date(dispute.filed_at).toLocaleDateString()}
          </p>
        </Card>
      ))}
    </div>
  );
}
