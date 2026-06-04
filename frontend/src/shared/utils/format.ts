/**
 * Pul/valyuta formatlash.
 *
 * Backend Numeric(18,4) ni str() qiladi → "60000.0000" / "5.0000".
 * Bu helper UZS uchun butun + minglik ajratuvchi, USD uchun 2 kasr ko'rsatadi.
 */

const UZS_FMT = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const USD_FMT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "60000.0000", "UZS" → "60 000 so'm"; "5.0000", "USD" → "$5.00" */
export function formatMoney(amount: string | number, currency: string | null | undefined): string {
  const n = typeof amount === 'number' ? amount : parseFloat(amount || '0');
  const safe = Number.isFinite(n) ? n : 0;
  const cur = (currency || 'USD').toUpperCase();
  if (cur === 'UZS') return `${UZS_FMT.format(Math.round(safe))} so'm`;
  if (cur === 'USD') return `$${USD_FMT.format(safe)}`;
  return `${USD_FMT.format(safe)} ${cur}`;
}
