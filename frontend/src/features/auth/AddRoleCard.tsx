import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, Role } from '@shared/store/auth';
import { useSelectRole } from '@shared/api/queries';
import { Card } from '@shared/components/Card';
import { haptic } from '@shared/hooks/useTelegram';

/**
 * Ikkinchi self-assignable rolni (orderer <-> carrier) qo'shish kartasi.
 *
 * Bir kishi ham buyurtma berishi, ham Turkiyaga yuk tashishi mumkin.
 * Faqat user'da yo'q bo'lgan rolni taklif qiladi (ikkalasi bo'lsa — ko'rinmaydi).
 */
export function AddRoleCard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const selectRole = useSelectRole();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const roles = user?.roles ?? [];
  const hasOrderer = roles.includes('orderer');
  const hasCarrier = roles.includes('carrier');

  let target: 'orderer' | 'carrier' | null = null;
  if (hasOrderer && !hasCarrier) target = 'carrier';
  else if (hasCarrier && !hasOrderer) target = 'orderer';
  if (!target) return null;

  const label =
    target === 'carrier'
      ? "✈️ Men ham yo'lovchi bo'laman"
      : '📦 Men ham buyurtma beraman';

  const onClick = async () => {
    if (loading) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await selectRole.mutateAsync(target!);
      useAuthStore.setState({
        token: res.access_token,
        user: {
          id: res.user_id,
          roles: res.roles as Role[],
          languageCode: res.language_code,
        },
        isAuthenticated: true,
      });
      haptic('success');
      navigate(target === 'carrier' ? '/carrier' : '/orderer');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Xatolik yuz berdi');
      setLoading(false);
    }
  };

  return (
    <Card
      className="cursor-pointer border border-dashed border-tg-button/40 active:scale-95"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{loading ? '⏳' : '➕'}</span>
        <span className="font-medium text-tg-button">{label}</span>
      </div>
      {err && <p className="mt-2 text-xs text-red-500">{err}</p>}
    </Card>
  );
}
