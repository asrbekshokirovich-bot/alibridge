/**
 * Tezkor qabul — buyurtmasiz tovarlarni qabul qilish.
 *
 * 1-qadam (form): nomi, soni, og'irlik
 * 2-qadam (result): yaratilgan mahsulotlar + QR kodlar
 */
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, extractErrorMessage } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { useBackButton, haptic } from '@shared/hooks/useTelegram';

interface QuickIntakeResponse {
  spec_id: string;
  count: number;
  products: Array<{ id: string; short_code: string; qr_payload: string }>;
}

interface LabelItem {
  id: string;
  short_code: string;
  qr_image_b64: string;
}

export default function WarehouseUzQuickIntake() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'form' | 'result'>('form');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [weightG, setWeightG] = useState('');
  const [specId, setSpecId] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useBackButton(() => {
    if (step === 'result') {
      setStep('form');
    } else {
      navigate(-1);
    }
  });

  // QR labellar — result bosqichida yuklanadi
  const { data: labels, isLoading: labelsLoading } = useQuery<LabelItem[]>({
    queryKey: ['quick-intake-labels', specId],
    queryFn: async () => {
      const { data } = await api.get<LabelItem[]>(
        `/warehouse/uz/quick-intake/${specId}/labels`
      );
      return data;
    },
    enabled: !!specId && step === 'result',
  });

  const intakeMutation = useMutation({
    mutationFn: async () => {
      const qty = parseInt(quantity);
      const wg = parseInt(weightG);
      if (!name.trim()) throw new Error("Mahsulot nomini kiriting");
      if (!qty || qty < 1 || qty > 500) throw new Error("Soni 1–500 oralig'ida bo'lishi kerak");
      if (!wg || wg < 1) throw new Error("Og'irlik (gramm) ni kiriting");

      const { data } = await api.post<QuickIntakeResponse>(
        '/warehouse/uz/quick-intake',
        { name: name.trim(), quantity: qty, weight_g: wg }
      );
      return data;
    },
    onSuccess: (data) => {
      haptic('success');
      setSpecId(data.spec_id);
      setCreatedCount(data.count);
      setStep('result');
      setError(null);
    },
    onError: (err: unknown) => {
      haptic('error');
      setError(err instanceof Error ? err.message : extractErrorMessage(err));
    },
  });

  // ── Form ekrani ─────────────────────────────────────────────────────────────
  if (step === 'form') {
    return (
      <div className="flex flex-col gap-3 p-4 pb-24">
        <div className="py-2">
          <h2 className="text-lg font-bold">⚡ Tezkor qabul</h2>
          <p className="text-sm text-tg-hint">
            Mahsulot ma'lumotlarini kiriting — QR kodlar avtomatik yaratiladi
          </p>
        </div>

        <Card>
          <div className="space-y-3">
            {/* Mahsulot nomi */}
            <div>
              <label className="mb-1 block text-xs font-medium text-tg-hint">
                Mahsulot nomi / modeli
              </label>
              <input
                type="text"
                placeholder="Masalan: Samsung A33, Iphone 15"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-tg-secondary-bg bg-tg-secondary-bg px-3 py-2 text-sm text-tg-text outline-none focus:border-tg-button"
              />
            </div>

            {/* Soni */}
            <div>
              <label className="mb-1 block text-xs font-medium text-tg-hint">
                Soni (dona)
              </label>
              <input
                type="number"
                min={1}
                max={500}
                placeholder="30"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-lg border border-tg-secondary-bg bg-tg-secondary-bg px-3 py-2 text-sm text-tg-text outline-none focus:border-tg-button"
              />
            </div>

            {/* Og'irlik */}
            <div>
              <label className="mb-1 block text-xs font-medium text-tg-hint">
                Bir dona og'irligi (gramm)
              </label>
              <input
                type="number"
                min={1}
                placeholder="150"
                value={weightG}
                onChange={(e) => setWeightG(e.target.value)}
                className="w-full rounded-lg border border-tg-secondary-bg bg-tg-secondary-bg px-3 py-2 text-sm text-tg-text outline-none focus:border-tg-button"
              />
            </div>
          </div>
        </Card>

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-center text-sm text-red-600">
            {error}
          </p>
        )}

        <Button
          fullWidth
          size="lg"
          loading={intakeMutation.isPending}
          onClick={() => intakeMutation.mutate()}
        >
          ✅ Qabul qilish va QR yaratish
        </Button>
      </div>
    );
  }

  // ── Result ekrani — QR kodlar ───────────────────────────────────────────────
  if (labelsLoading) return <LoadingScreen />;

  return (
    <div className="flex flex-col gap-3 p-4 pb-24">
      {/* Sarlavha */}
      <Card className="bg-green-50">
        <div className="text-center">
          <p className="text-2xl">✅</p>
          <p className="mt-1 font-bold text-green-700">
            {createdCount} ta mahsulot yaratildi
          </p>
          <p className="text-sm text-green-600">{name}</p>
          <p className="mt-1 text-xs text-tg-hint">
            QR kodlarni mahsulotlarga yoprishtiring
          </p>
        </div>
      </Card>

      {/* QR kodlar ro'yxati */}
      {labels?.map((item) => (
        <Card key={item.id}>
          <div className="flex items-center gap-3">
            {/* QR rasm */}
            <img
              src={`data:image/png;base64,${item.qr_image_b64}`}
              alt={item.short_code}
              className="h-20 w-20 flex-shrink-0 rounded"
            />
            {/* Ma'lumotlar */}
            <div>
              <p className="font-mono text-xl font-bold tracking-wider">
                {item.short_code}
              </p>
              <p className="text-xs text-tg-hint">{name}</p>
            </div>
          </div>
        </Card>
      ))}

      {/* Yangi qabul tugmasi */}
      <Button
        fullWidth
        variant="secondary"
        onClick={() => {
          setStep('form');
          setName('');
          setQuantity('');
          setWeightG('');
          setSpecId(null);
        }}
      >
        ⚡ Yangi qabul
      </Button>
    </div>
  );
}
