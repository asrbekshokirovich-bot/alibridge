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
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-4xl bg-white/5 text-4xl ring-1 ring-white/10">
          🔐
        </div>
        <p className="mb-2 text-lg font-bold text-tg-text">Kirish mumkin emas</p>
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
      <div className="relative flex min-h-screen flex-col overflow-hidden p-5">
        {/* Fon glow */}
        <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-500/25 blur-3xl" />

        {/* Sarlavha */}
        <div className="relative z-10 pb-6 pt-10 text-center animate-fade-in">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-4xl bg-hero-violet text-4xl shadow-glow-violet">
            🌉
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-tg-text">ALI BRIDGE</h1>
          <p className="mt-1.5 text-sm text-tg-hint">Siz kim ekansiz?</p>
        </div>

        {/* Tanlov kartalari */}
        <div className="relative z-10 flex flex-col gap-4 animate-slide-up">
          {/* Yo'lovchi / Carrier — violet gradient */}
          <button
            className="w-full text-left disabled:opacity-60"
            disabled={selectingRole !== null}
            onClick={() => handleSelectRole('carrier')}
          >
            <div className="relative overflow-hidden rounded-5xl bg-hero-violet p-6 shadow-glow-violet transition-all active:scale-[0.97]">
              <div className="pointer-events-none absolute -right-6 -top-8 h-32 w-32 rounded-full bg-white/15 blur-xl" />
              <div className="relative flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white/20 text-3xl backdrop-blur">
                  ✈️
                </span>
                <div className="flex-1">
                  <p className="text-lg font-extrabold text-white">Turkiyaga ketaman</p>
                  <p className="mt-0.5 text-sm text-white/80">
                    Yo'lovchi sifatida ro'yxatdan o'taman va yuk tashiyman
                  </p>
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-lg font-bold text-white">
                  {selectingRole === 'carrier' ? '⏳' : '›'}
                </span>
              </div>
            </div>
          </button>

          {/* Buyurtmachi / Orderer — lime */}
          <button
            className="w-full text-left disabled:opacity-60"
            disabled={selectingRole !== null}
            onClick={() => handleSelectRole('orderer')}
          >
            <div className="relative overflow-hidden rounded-5xl bg-accent-lime p-6 shadow-glow-lime transition-all active:scale-[0.97]">
              <div className="pointer-events-none absolute -right-6 -top-8 h-32 w-32 rounded-full bg-white/30 blur-xl" />
              <div className="relative flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-black/10 text-3xl">
                  📦
                </span>
                <div className="flex-1">
                  <p className="text-lg font-extrabold text-[#0a0a0f]">Buyurtma beraman</p>
                  <p className="mt-0.5 text-sm text-[#0a0a0f]/70">Xitoydan mahsulot oldiraman</p>
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/10 text-lg font-bold text-[#0a0a0f]">
                  {selectingRole === 'orderer' ? '⏳' : '›'}
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Xato xabari */}
        {error && (
          <p className="relative z-10 mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-center text-sm text-red-400 ring-1 ring-red-500/20">
            {error}
          </p>
        )}

        {/* Til tanlash */}
        <div className="relative z-10 mt-auto pt-6">
          <LanguageSelector />
        </div>

        {/* Kuryer / ombor uchun izoh */}
        <p className="relative z-10 pt-2 text-center text-xs text-tg-hint">
          Kuryer va ombor xodimlari uchun rolni admin tayinlaydi
        </p>
      </div>
    );
  }

  // ── Bir nechta rol → tanlash ───────────────────────────────────────────────
  return (
    <div className="space-y-3 p-5">
      <h2 className="px-1 pt-6 text-2xl font-extrabold tracking-tight text-tg-text">
        Qaysi rolda ishlaysiz?
      </h2>
      <div className="space-y-3 animate-slide-up">
        {user.roles.map((role, i) => (
          <Card
            key={role}
            className="cursor-pointer transition-all active:scale-[0.97]"
            onClick={() => {
              const path = roleToPath(role);
              if (path) navigate(path);
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${roleTile(i)}`}
                >
                  {roleEmoji(role)}
                </span>
                <span className="font-bold text-tg-text">
                  {t(`roles.${role}`, { defaultValue: role })}
                </span>
              </div>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-tg-hint">
                ›
              </span>
            </div>
          </Card>
        ))}
      </div>
      <LanguageSelector />
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function roleToPath(role: Role): string | null {
  const map: Record<Role, string> = {
    orderer: '/orderer',
    carrier: '/carrier',
    china_worker: '/china',
    warehouse_uz: '/warehouse-uz',
    warehouse_tr: '/warehouse-tr',
    courier_uz: '/couriers',
    courier_tr: '/couriers',
    admin: '/admin',
  };
  return map[role] ?? null;
}

function roleEmoji(role: Role): string {
  const map: Record<Role, string> = {
    orderer: '📦',
    carrier: '✈️',
    china_worker: '🇨🇳',
    warehouse_uz: '🏭',
    warehouse_tr: '🏬',
    courier_uz: '🛵',
    courier_tr: '🚚',
    admin: '⚙️',
  };
  return map[role] ?? '👤';
}

// Icon tile rangi — accent ranglar aylanma tarzda
function roleTile(i: number): string {
  const tiles = [
    'bg-brand-500/20 text-brand-200',
    'bg-accent-lime/20 text-accent-lime',
    'bg-accent-pink/20 text-accent-pink',
    'bg-accent-blue/20 text-accent-blue',
    'bg-accent-cyan/20 text-accent-cyan',
    'bg-accent-amber/20 text-accent-amber',
  ];
  return tiles[i % tiles.length]!;
}
