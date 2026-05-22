import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { useNavigate } from 'react-router-dom';

export default function OnboardingPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-4 p-4">
      <div className="text-center">
        <div className="text-5xl">📦</div>
        <h1 className="mt-2 text-xl font-bold">ALI BRIDGE</h1>
        <p className="text-sm text-tg-hint">🇨🇳 → 🇺🇿 → 🇹🇷</p>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold">Xush kelibsiz!</h2>
        <p className="text-sm text-tg-hint">
          Bu xizmat orqali siz Xitoydan Turkiyaga kargo yetkazib berishingiz
          yoki yetkazilgan tovarlarni qabul qilishingiz mumkin.
        </p>
      </Card>

      <Button fullWidth onClick={() => navigate('/')}>
        Boshlash
      </Button>
    </div>
  );
}
