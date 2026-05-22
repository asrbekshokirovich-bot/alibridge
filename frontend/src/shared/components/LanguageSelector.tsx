import { useTranslation } from 'react-i18next';
import { useUpdateLanguage } from '@shared/api/queries';

const LANGS = [
  { code: 'uz', label: "O'Z", flag: '🇺🇿' },
  { code: 'ru', label: 'RU', flag: '🇷🇺' },
  { code: 'tr', label: 'TR', flag: '🇹🇷' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
] as const;

export function LanguageSelector() {
  const { i18n } = useTranslation();
  const updateLang = useUpdateLanguage();

  const handleChange = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('lang', code);
    updateLang.mutate(code);
  };

  return (
    <div className="flex justify-center gap-1.5 py-2">
      {LANGS.map(({ code, label, flag }) => (
        <button
          key={code}
          onClick={() => handleChange(code)}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all
            ${i18n.language.startsWith(code)
              ? 'bg-tg-button text-tg-button-text'
              : 'bg-tg-secondary-bg text-tg-hint hover:text-tg-text'
            }`}
        >
          {flag} {label}
        </button>
      ))}
    </div>
  );
}
