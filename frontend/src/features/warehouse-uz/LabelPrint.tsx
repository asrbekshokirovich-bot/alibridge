import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api, extractErrorMessage } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { useBackButton, haptic } from '@shared/hooks/useTelegram';

interface LabelBatch {
  id: string;
  order_number: string;
  product_count: number;
  label_printed_at: string | null;
}

export default function WarehouseUzLabelPrint() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [printing, setPrinting] = useState<string | null>(null);

  useBackButton(() => navigate(-1));

  const { data, isLoading, refetch } = useQuery<LabelBatch[]>({
    queryKey: ['label-batches'],
    queryFn: async () => {
      const { data } = await api.get<LabelBatch[]>('/warehouse/uz/labels/pending');
      return data;
    },
  });

  const printMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // PDF ni oching (Telegram WebApp openLink orqali)
      const { data } = await api.post<{ pdf_url: string }>(
        `/warehouse/uz/labels/print/${orderId}`
      );
      return data;
    },
    onSuccess: (data) => {
      haptic('success');
      // Telegram WebApp'da tashqi havolani ochish (pdf_url null bo'lsa skip)
      if (data.pdf_url) {
        window.Telegram?.WebApp?.openLink(data.pdf_url);
      }
      refetch();
    },
    onError: (error) => {
      haptic('error');
      alert(extractErrorMessage(error));
    },
    onSettled: () => setPrinting(null),
  });

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="space-y-3 p-4 pb-20">
      <h2 className="px-1 text-lg font-bold">{t('warehouse.labels')}</h2>

      {!data || data.length === 0 ? (
        <Card>
          <p className="text-center text-sm text-tg-hint">{t('warehouse.no_labels')}</p>
        </Card>
      ) : (
        data.map((batch) => (
          <Card key={batch.id}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{batch.order_number}</p>
                <p className="text-sm text-tg-hint">
                  {batch.product_count} {t('warehouse.products')}
                </p>
                {batch.label_printed_at && (
                  <p className="text-xs text-tg-hint">
                    🖨️ {new Date(batch.label_printed_at).toLocaleString()}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                loading={printing === batch.id}
                onClick={() => {
                  setPrinting(batch.id);
                  printMutation.mutate(batch.id);
                }}
              >
                {batch.label_printed_at ? t('warehouse.reprint') : t('warehouse.print')}
              </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
