import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore, Role } from '@shared/store/auth';
import { Card } from '@shared/components/Card';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { useSelectRole } from '@shared/api/queries';
import { LanguageSelector } from '@shared/components/LanguageSelector';

/**
 * Home page — rol bo'yicha avtomatik redirect.
 *
 * Agar foydalanuvchida rol bo'lmasa → rol tanlash ekrani.
 * Bir rol → darhol redirect.
 * Bir nechta rol → tanlash ekrani.
 *
 * MUHIM: Har safar app ochilganda login() chaqiriladi — yangi JWT va rollar olish uchun.
 * Shu sababli admin rol bersa, foydalanuvchi botni qayta ochganda darhol yangi ekran ko'rinadi.
 */
export default function HomePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading, login } = useAuthStore();
  const selectRole = useSelectRole();
  const [selectingRole, setSelectingRole] = useState<'orderer' | 'carrier' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loginFailed, setLoginFailed] = useState(false);
  // Strict Mode'da ikki marta chaqirilmasin
  const loginAttempted = useRef(false);

  // Har safar app ochilganda yangi JWT olish (rollar o'zgargan bo'lishi mumkin)
  useEffect(() => {
    if (!loginAttempted.current) {
      loginAttempted.current = true;
      login().catch((err) => {
        console.error('Login failed:', err);
        setLoginFailed(true);
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Bir rol bo'lsa — darhol redirect
  useEffect(() => {
    if (!isLoading && user?.roles && user.roles.length === 1) {
      const path = roleToPath(user.roles[0]!);
      if (path) navigate(path, { replace: true });
    }
  }, [user, isLoading, navigate]);

  // Rol tanlash handler
  const handleSelectRole = async (role: 'orderer' | 'carrier') => {
    setSelectingRole(role);
    setError(null);
    try {
      const res = await selectRole.mutateAsync(role);
      // Auth store'ni yangilash — yangi JWT va rol bilan
      useAuthStore.setState({
        token: res.access_token,
        user: {
          id: res.user_id,
          roles: res.roles as Role[],
          languageCode: res.language_code,
        },
        isAuthenticated: true,
      });
      // Redirect useEffect orqali sodir bo'ladi
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Xatolik yuz berdi. Qayta urinib ko'ring.";
      setError(msg);
      setSelectingRole(null);
    }
  };

  // Login muvaffaqiyatsiz va saqlangan token ham yo'q
  if (loginFailed && !isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 text-5xl">🔐</div>
        <p className="mb-2 font-semibold text-tg-text">Kirish mumkin emas</p>
        <p className="text-sm text-tg-hint">Telegram orqali Mini App ni oching</p>
      </div>
    );
  }

  // Yangi JWT kelgunicha loading (isLoading=true yoki hali login boshlanmagan)
  if (isLoading || (!isAuthenticated && !loginFailed)) {
    return <LoadingScreen />;
  }

  // ── Rol yo'q → tanlash ekrani ──────────────────────────────────────────────
  if (!user || user.roles.length === 0) {
    return (
      <div className="flex min-h-screen flex-col p-4">
        {/* Sarlavha */}
        <div className="py-8 text-center">
          <div className="mb-3 text-5xl">🌉</div>
          <h1 className="text-2xl font-bold text-tg-text">ALI BRIDGE</h1>
          <p className="mt-1 text-sm text-tg-hint">Siz kim ekansiz?</p>
        </div>

        {/* Tanlov kartalari */}
        <div className="flex flex-col gap-3">
          {/* Yo'lovchi / Carrier */}
          <button
            className="w-full text-left disabled:opacity-60"
            disabled={selectingRole !== null}
            onClick={() => handleSelectRole('carrier')}
          >
            <Card className="transition-all active:scale-95">
              <div className="flex items-center gap-4">
                <span className="text-4xl">✈️</span>
                <div className="flex-1">
                  <p className="font-semibold text-tg-text">
                    Turkiyaga ketaman
                  </p>
                  <p className="mt-0.5 text-sm text-tg-hint">
                    Yo'lovchi sifatida ro'yxatdan o'taman va yuk tashiyman
                  </p>
                </div>
                {selectingRole === 'carrier' ? (
                  <span className="text-tg-hint animate-spin">⏳</span>
                ) : (
                  <span className="text-tg-hint">›</span>
                )}
              </div>
            </Card>
          </button>

          {/* Buyurtmachi / Orderer */}
          <button
            className="w-full text-left disabled:opacity-60"
            disabled={selectingRole !== null}
            onClick={() => handleSelectRole('orderer')}
          >
            <Card className="transition-all active:scale-95">
              <div className="flex items-center gap-4">
                <span className="text-4xl">📦</span>
                <div className="flex-1">
                  <p className="font-semibold text-tg-text">
                    Buyurtma beraman
                  </p>
                  <p className="mt-0.5 text-sm text-tg-hint">
                    Xitoydan mahsulot oldiraman
                  </p>
                </div>
                {selectingRole === 'orderer' ? (
                  <span className="text-tg-hint animate-spin">⏳</span>
                ) : (
                  <span className="text-tg-hint">›</span>
                )}
              </div>
            </Card>
          </button>
        </div>

        {/* Xato xabari */}
        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-center text-sm text-red-600">
            {error}
          </p>
        )}

        {/* Til tanlash */}
        <div className="mt-auto pt-6">
          <LanguageSelector />
        </div>

        {/* Kuryer / ombor uchun izoh */}
        <p className="pt-2 text-center text-xs text-tg-hint">
          Kuryer va ombor xodimlari uchun rolni admin tayinlaydi
        </p>
      </div>
    );
  }

  // ── Bir nechta rol → tanlash ───────────────────────────────────────────────
  return (
    <div className="space-y-3 p-4">
      <h2 className="px-1 text-lg font-semibold text-tg-text">
        Qaysi rolda ishlaysiz?
      </h2>
      {user.roles.map((role) => (
        <Card
          key={role}
          className="cursor-pointer transition-all active:scale-95"
          onClick={() => {
            const path = roleToPath(role);
            if (path) navigate(path);
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{roleEmoji(role)}</span>
              <span className="font-medium text-tg-text">{t(`roles.${role}`, { defaultValue: role })}</span>
            </div>
            <span className="text-tg-hint">›</span>
          </div>
        </Card>
      ))}
      <LanguageSelector />
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function roleToPath(role: Role): string | null {
  const map: Record<Role, string> = {
    orderer: '/orderer',
    carrier: '/carrier',
    warehouse_uz: '/warehouse-uz',
    warehouse_tr: '/warehouse-tr',
    china_worker: '/china',
    courier_uz: '/courier',
    courier_tr: '/courier',
    admin: '/admin',
  };
  return map[role] ?? null;
}

function roleEmoji(role: Role): string {
  const map: Record<Role, string> = {
    orderer: '📦',
    carrier: '✈️',
    warehouse_uz: '🏭',
    warehouse_tr: '🏬',
    china_worker: '🇨🇳',
    courier_uz: '🛵',
    courier_tr: '🚚',
    admin: '⚙️',
  };
  return map[role] ?? '👤';
}

