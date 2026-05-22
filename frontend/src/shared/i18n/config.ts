import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import uz from './locales/uz.json';
import ru from './locales/ru.json';
import tr from './locales/tr.json';
import en from './locales/en.json';

export type Language = 'uz' | 'ru' | 'tr' | 'en';

export const SUPPORTED_LANGUAGES: Language[] = ['uz', 'ru', 'tr', 'en'];
export const DEFAULT_LANGUAGE: Language = 'uz';

/**
 * Tilni aniqlash: localStorage → Telegram language_code → 'uz'
 *
 * MUHIM: bu funksiya i18n.init() DAN OLDIN chaqiriladi, shuning uchun
 * LanguageDetector ishlatmasdan to'g'ridan-to'g'ri `lng` ni o'rnatamiz.
 * (ES module import'lari hoisted bo'lgani uchun App.tsx dagi kod kechroq ishga tushadi.)
 */
function detectLanguage(): Language {
  // 1. Foydalanuvchi avval tanlagan til
  const stored = localStorage.getItem('lang') as Language | null;
  if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored;

  // 2. Telegram WebApp foydalanuvchi tili
  type TelegramWindow = Window & {
    Telegram?: { WebApp?: { initDataUnsafe?: { user?: { language_code?: string } } } };
  };
  const tgLang = (window as TelegramWindow).Telegram?.WebApp?.initDataUnsafe?.user?.language_code ?? '';
  const fromTelegram = SUPPORTED_LANGUAGES.includes(tgLang as Language)
    ? (tgLang as Language)
    : DEFAULT_LANGUAGE;

  // Keshga saqlash — keyingi sessiyalarda ham ishlashi uchun
  localStorage.setItem('lang', fromTelegram);
  return fromTelegram;
}

const initialLanguage = detectLanguage();

i18n
  .use(initReactI18next)
  .init({
    resources: {
      uz: { translation: uz },
      ru: { translation: ru },
      tr: { translation: tr },
      en: { translation: en },
    },
    lng: initialLanguage,          // aniq til — LanguageDetector kerak emas
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
