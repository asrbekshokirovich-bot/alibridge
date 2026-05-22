import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@shared/api/client';
import { Button } from '@shared/components/Button';
import { Card } from '@shared/components/Card';
import { useBackButton } from '@shared/hooks/useTelegram';

type Step = 'consent' | 'phone' | 'passport' | 'ticket' | 'route' | 'confirm' | 'done';

interface FormData {
  phone: string;
  routeKey: string;
  departIata: string;
  arriveIata: string;
  departDate: string;
  departTime: string;
  allowedKg: string;
  flightNumber: string;
  passportPhotoUrl: string;
  ticketPhotoUrl: string;
  passportPreview: string;
  ticketPreview: string;
}

const ROUTES: Record<string, { from: string; to: string }> = {
  'TAS-IST': { from: 'Toshkent (TAS)', to: 'Istanbul Atatürk (IST)' },
  'TAS-SAW': { from: 'Toshkent (TAS)', to: 'Istanbul Sabiha (SAW)' },
  'SKD-IST': { from: 'Samarqand (SKD)', to: 'Istanbul Atatürk (IST)' },
  'UGC-IST': { from: 'Urganch (UGC)',   to: 'Istanbul Atatürk (IST)' },
  'NMA-IST': { from: 'Namangan (NMA)',  to: 'Istanbul Atatürk (IST)' },
  'FEG-IST': { from: "Farg'ona (FEG)",  to: 'Istanbul Atatürk (IST)' },
};

const WIZARD_STEPS: Step[] = ['consent', 'phone', 'passport', 'ticket', 'route', 'confirm'];

export default function CarrierOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('consent');
  const [loading, setLoading] = useState(false);
  const [uploadingPassport, setUploadingPassport] = useState(false);
  const [uploadingTicket, setUploadingTicket] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({
    phone: '',
    routeKey: 'TAS-IST',
    departIata: 'TAS',
    arriveIata: 'IST',
    departDate: '',
    departTime: '10:00',
    allowedKg: '20',
    flightNumber: '',
    passportPhotoUrl: '',
    ticketPhotoUrl: '',
    passportPreview: '',
    ticketPreview: '',
  });

  const stepIdx = WIZARD_STEPS.indexOf(step);
  const progress = ((stepIdx + 1) / WIZARD_STEPS.length) * 100;

  const PREV_STEP: Partial<Record<Step, Step>> = {
    phone: 'consent',
    passport: 'phone',
    ticket: 'passport',
    route: 'ticket',
    confirm: 'route',
  };

  const handleTgBack = useCallback(() => {
    const prev = PREV_STEP[step];
    if (prev) setStep(prev);
    else navigate(-1);
  }, [step, navigate]); // eslint-disable-line react-hooks/exhaustive-deps
  useBackButton(handleTgBack);

  const update = (field: keyof FormData, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleRouteChange = (key: string) => {
    const [dep, arr] = key.split('-');
    setForm((f) => ({ ...f, routeKey: key, departIata: dep!, arriveIata: arr! }));
  };

  // ── Photo upload helper ────────────────────────────────────────────────────
  const uploadPhoto = async (
    file: File,
    category: 'passport' | 'ticket',
  ): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await api.post<{ url: string }>(
      `/uploads?category=${category}`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data.url;
  };

  const handlePassportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPassport(true);
    setError(null);
    try {
      const url = await uploadPhoto(file, 'passport');
      update('passportPhotoUrl', url);
      update('passportPreview', URL.createObjectURL(file));
    } catch {
      setError("Rasmni yuklashda xatolik. Qayta urinib ko'ring.");
    } finally {
      setUploadingPassport(false);
    }
  };

  const handleTicketFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingTicket(true);
    setError(null);
    try {
      const url = await uploadPhoto(file, 'ticket');
      update('ticketPhotoUrl', url);
      update('ticketPreview', URL.createObjectURL(file));
    } catch {
      setError("Rasmni yuklashda xatolik. Qayta urinib ko'ring.");
    } finally {
      setUploadingTicket(false);
    }
  };

  // ── Form submit ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const departAt = new Date(
        `${form.departDate}T${form.departTime}:00`,
      ).toISOString();

      await api.post('/carrier/profile', {
        phone: form.phone,
        depart_iata: form.departIata,
        arrive_iata: form.arriveIata,
        depart_at: departAt,
        allowed_kg: parseFloat(form.allowedKg),
        flight_number: form.flightNumber || null,
        passport_photo_url: form.passportPhotoUrl,
        ticket_photo_url: form.ticketPhotoUrl,
      });
      setStep('done');
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Xatolik yuz berdi. Qayta urinib ko'ring.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 text-6xl">✅</div>
        <h2 className="mb-2 text-xl font-bold text-tg-text">Muvaffaqiyatli ro'yxatdan o'tdingiz!</h2>
        <p className="mb-8 text-sm text-tg-hint">
          Endi katalogdan mahsulotlar tanlab olishingiz mumkin.
        </p>
        <Button variant="primary" fullWidth onClick={() => navigate('/carrier/catalog')}>
          Katalogga o'tish →
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col p-4">

      {/* Progress bar */}
      {(
        <div className="mb-6">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-tg-hint">{stepIdx + 1} / {WIZARD_STEPS.length}</span>
            <span className="font-medium text-tg-text">{stepTitle(step)}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-tg-secondaryBg">
            <div
              className="h-full rounded-full bg-tg-button transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* ── CONSENT ─────────────────────────────────────────────────────────── */}
      {step === 'consent' && (
        <div className="flex flex-1 flex-col gap-4">
          <h2 className="text-xl font-bold text-tg-text">✈️ Yo'lovchi sifatida ro'yxat</h2>

          <Card>
            <p className="mb-3 text-sm font-semibold text-tg-text">Ro'yxatdan o'tish uchun kerak:</p>
            <ul className="space-y-2 text-sm text-tg-hint">
              <li>📱 Telefon raqamingiz</li>
              <li>🪪 Passport rasmi (bio-sahifa)</li>
              <li>🎫 Aviabilet rasmi</li>
              <li>🛫 Jo'nash yo'nalishi va sanasi</li>
              <li>⚖️ Tashiy oladigan maksimal og'irlik</li>
            </ul>
          </Card>

          <Card>
            <p className="text-xs leading-relaxed text-tg-hint">
              ⚠️ <strong className="text-tg-text">Javobgarlik:</strong> Siz tanlagan yuklar uchun
              to'liq javobgar bo'lasiz. Yuk yo'qolsa yoki shikastlansa, belgilangan qoidalarga
              ko'ra muammo hal etiladi.
            </p>
          </Card>

          <div className="mt-auto">
            <Button variant="primary" fullWidth onClick={() => setStep('phone')}>
              Roziman, davom etish →
            </Button>
          </div>
        </div>
      )}

      {/* ── PHONE ───────────────────────────────────────────────────────────── */}
      {step === 'phone' && (
        <div className="flex flex-1 flex-col gap-4">
          <h2 className="text-xl font-bold text-tg-text">📱 Telefon raqam</h2>
          <p className="text-sm text-tg-hint">
            Buyurtmachilar bilan bog'lanish uchun raqamingizni kiriting.
          </p>

          <div>
            <label className="mb-1 block text-xs font-medium text-tg-hint">Telefon raqam</label>
            <input
              type="tel"
              inputMode="tel"
              placeholder="+998 90 123 45 67"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              autoFocus
              className="w-full rounded-xl bg-tg-secondaryBg px-4 py-3 text-tg-text outline-none focus:ring-2 focus:ring-tg-button/40"
            />
          </div>

          <div className="mt-auto flex gap-3">
            <Button variant="secondary" onClick={() => setStep('consent')}>← Orqaga</Button>
            <Button
              variant="primary"
              fullWidth
              disabled={form.phone.replace(/\D/g, '').length < 7}
              onClick={() => setStep('passport')}
            >
              Davom etish →
            </Button>
          </div>
        </div>
      )}

      {/* ── PASSPORT PHOTO ──────────────────────────────────────────────────── */}
      {step === 'passport' && (
        <div className="flex flex-1 flex-col gap-4">
          <h2 className="text-xl font-bold text-tg-text">🪪 Passport rasmi</h2>
          <p className="text-sm text-tg-hint">
            Passport bio-sahifasini (ma'lumotlar yozilgan tomonini) rasmga oling yoki galereadan tanlang.
          </p>

          {/* Preview */}
          {form.passportPreview && (
            <img
              src={form.passportPreview}
              alt="Passport"
              className="w-full max-h-52 rounded-xl object-cover"
            />
          )}

          {/* Upload zone */}
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-tg-button/40 p-6 active:bg-tg-secondaryBg">
            {uploadingPassport ? (
              <span className="text-sm text-tg-hint">Yuklanmoqda…</span>
            ) : (
              <>
                <span className="text-4xl">{form.passportPhotoUrl ? '✅' : '📷'}</span>
                <span className="text-sm text-tg-hint">
                  {form.passportPhotoUrl ? 'Qayta tanlash' : 'Rasmga olish yoki tanlash'}
                </span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={uploadingPassport}
              onChange={handlePassportFile}
            />
          </label>

          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          <div className="mt-auto flex gap-3">
            <Button variant="secondary" onClick={() => setStep('phone')}>← Orqaga</Button>
            <Button
              variant="primary"
              fullWidth
              disabled={!form.passportPhotoUrl || uploadingPassport}
              loading={uploadingPassport}
              onClick={() => setStep('ticket')}
            >
              Davom etish →
            </Button>
          </div>
        </div>
      )}

      {/* ── TICKET PHOTO ────────────────────────────────────────────────────── */}
      {step === 'ticket' && (
        <div className="flex flex-1 flex-col gap-4">
          <h2 className="text-xl font-bold text-tg-text">🎫 Aviabilet rasmi</h2>
          <p className="text-sm text-tg-hint">
            Elektron bilet yoki bron tasdiqlash rasmini yuklang.
          </p>

          {/* Preview */}
          {form.ticketPreview && (
            <img
              src={form.ticketPreview}
              alt="Bilet"
              className="w-full max-h-52 rounded-xl object-cover"
            />
          )}

          {/* Upload zone */}
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-tg-button/40 p-6 active:bg-tg-secondaryBg">
            {uploadingTicket ? (
              <span className="text-sm text-tg-hint">Yuklanmoqda…</span>
            ) : (
              <>
                <span className="text-4xl">{form.ticketPhotoUrl ? '✅' : '🎫'}</span>
                <span className="text-sm text-tg-hint">
                  {form.ticketPhotoUrl ? 'Qayta tanlash' : 'Rasmga olish yoki tanlash'}
                </span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={uploadingTicket}
              onChange={handleTicketFile}
            />
          </label>

          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          <div className="mt-auto flex gap-3">
            <Button variant="secondary" onClick={() => setStep('passport')}>← Orqaga</Button>
            <Button
              variant="primary"
              fullWidth
              disabled={!form.ticketPhotoUrl || uploadingTicket}
              loading={uploadingTicket}
              onClick={() => setStep('route')}
            >
              Davom etish →
            </Button>
          </div>
        </div>
      )}

      {/* ── ROUTE ───────────────────────────────────────────────────────────── */}
      {step === 'route' && (
        <div className="flex flex-1 flex-col gap-4">
          <h2 className="text-xl font-bold text-tg-text">🛫 Yo'nalish ma'lumotlari</h2>

          <div>
            <label className="mb-1 block text-xs font-medium text-tg-hint">Yo'nalish</label>
            <select
              value={form.routeKey}
              onChange={(e) => handleRouteChange(e.target.value)}
              className="w-full rounded-xl bg-tg-secondaryBg px-4 py-3 text-tg-text outline-none focus:ring-2 focus:ring-tg-button/40"
            >
              {Object.entries(ROUTES).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.from} → {val.to}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-tg-hint">Jo'nash sanasi</label>
              <input
                type="date"
                value={form.departDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => update('departDate', e.target.value)}
                className="w-full rounded-xl bg-tg-secondaryBg px-3 py-3 text-tg-text outline-none focus:ring-2 focus:ring-tg-button/40"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-tg-hint">Vaqti</label>
              <input
                type="time"
                value={form.departTime}
                onChange={(e) => update('departTime', e.target.value)}
                className="w-full rounded-xl bg-tg-secondaryBg px-3 py-3 text-tg-text outline-none focus:ring-2 focus:ring-tg-button/40"
              />
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-tg-hint">Maksimal og'irlik</label>
              <span className="text-sm font-bold text-tg-text">{form.allowedKg} kg</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={form.allowedKg}
              onChange={(e) => update('allowedKg', e.target.value)}
              className="w-full accent-tg-button"
            />
            <div className="mt-0.5 flex justify-between text-xs text-tg-hint">
              <span>1 kg</span>
              <span>50 kg</span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-tg-hint">
              Reys raqami <span className="text-tg-hint">(ixtiyoriy)</span>
            </label>
            <input
              type="text"
              placeholder="HY 101"
              value={form.flightNumber}
              onChange={(e) => update('flightNumber', e.target.value.toUpperCase())}
              className="w-full rounded-xl bg-tg-secondaryBg px-4 py-3 text-tg-text outline-none focus:ring-2 focus:ring-tg-button/40"
            />
          </div>

          <div className="mt-auto flex gap-3">
            <Button variant="secondary" onClick={() => setStep('ticket')}>← Orqaga</Button>
            <Button
              variant="primary"
              fullWidth
              disabled={!form.departDate}
              onClick={() => setStep('confirm')}
            >
              Davom etish →
            </Button>
          </div>
        </div>
      )}

      {/* ── CONFIRM ─────────────────────────────────────────────────────────── */}
      {step === 'confirm' && (
        <div className="flex flex-1 flex-col gap-4">
          <h2 className="text-xl font-bold text-tg-text">✅ Ma'lumotlarni tekshiring</h2>

          <Card>
            <dl className="space-y-3 text-sm">
              <InfoRow label="📱 Telefon" value={form.phone} />
              <InfoRow
                label="✈️ Yo'nalish"
                value={`${ROUTES[form.routeKey]?.from} → ${ROUTES[form.routeKey]?.to}`}
              />
              <InfoRow
                label="📅 Jo'nash"
                value={`${form.departDate} ${form.departTime}`}
              />
              <InfoRow label="⚖️ Og'irlik" value={`${form.allowedKg} kg`} />
              {form.flightNumber && (
                <InfoRow label="🔢 Reys" value={form.flightNumber} />
              )}
              <InfoRow label="🪪 Passport" value={form.passportPhotoUrl ? '✅ Yuklangan' : '❌ Yuklanmagan'} />
              <InfoRow label="🎫 Bilet" value={form.ticketPhotoUrl ? '✅ Yuklangan' : '❌ Yuklanmagan'} />
            </dl>
          </Card>

          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          <div className="mt-auto flex gap-3">
            <Button variant="secondary" onClick={() => setStep('route')}>← Orqaga</Button>
            <Button variant="primary" fullWidth loading={loading} onClick={handleSubmit}>
              Tasdiqlash va ro'yxatdan o'tish
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function stepTitle(step: Step): string {
  const titles: Record<Step, string> = {
    consent: 'Shartlar',
    phone: 'Telefon',
    passport: 'Passport',
    ticket: 'Bilet',
    route: "Yo'nalish",
    confirm: 'Tasdiqlash',
    done: 'Tayyor',
  };
  return titles[step] ?? step;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="shrink-0 text-tg-hint">{label}</dt>
      <dd className="text-right font-medium text-tg-text">{value}</dd>
    </div>
  );
}
