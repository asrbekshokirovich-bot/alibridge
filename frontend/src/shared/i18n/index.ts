import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ru from './locales/ru.json'
import en from './locales/en.json'
import tr from './locales/tr.json'

export const LANGS = [
  { code: 'uz', label: "O'zbekcha", flag: '🇺🇿' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
] as const

export type LangCode = (typeof LANGS)[number]['code']

const STORAGE_KEY = 'lang'

// Telegram foydalanuvchi tilidan boshlang'ich tilni aniqlash.
// Saqlangan tanlov ustun; bo'lmasa Telegram language_code; aks holda uz.
function detectLang(): LangCode {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && LANGS.some((l) => l.code === saved)) return saved as LangCode

  const tgCode = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code
  if (tgCode) {
    const short = tgCode.slice(0, 2).toLowerCase()
    if (LANGS.some((l) => l.code === short)) return short as LangCode
  }
  return 'uz'
}

// uz — kalitning o'zi matn (resourcesiz fallback). ru/en/tr — tarjima fayllar.
i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    en: { translation: en },
    tr: { translation: tr },
  },
  lng: detectLang(),
  fallbackLng: 'uz',
  // Kalitlar — tabiiy o'zbekcha gaplar (nuqta, ":" bor), shuning uchun
  // kalit/namespace ajratgichlarini o'chiramiz.
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  returnEmptyString: false,
})

export function setLang(code: LangCode) {
  localStorage.setItem(STORAGE_KEY, code)
  i18n.changeLanguage(code)
}

export function getLang(): LangCode {
  return (i18n.language as LangCode) || 'uz'
}

export default i18n
