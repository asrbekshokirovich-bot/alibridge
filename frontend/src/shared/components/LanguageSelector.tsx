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
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all active:scale-95
            ${i18n.language.startsWith(code)
              ? 'bg-gradient-to-br from-brand-400 to-accent-blue text-white shadow-glow-violet'
              : 'bg-white/5 text-tg-hint ring-1 ring-white/10 hover:text-tg-text'
            }`}
        >
          {flag} {label}
        </button>
      ))}
    </div>
  );
}
