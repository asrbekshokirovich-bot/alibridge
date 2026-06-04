/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // App theme — premium dark palette.
        // tg.* tokenlar endi --app-* o'zgaruvchilarga bog'langan (Telegram
        // theme'ga emas), shuning uchun barcha ekran bir xil dark ko'rinadi.
        tg: {
          bg: 'var(--app-bg, #0a0a0f)',
          text: 'var(--app-text, #f4f4f6)',
          hint: 'var(--app-hint, #8a8a94)',
          link: 'var(--app-link, #9d8cff)',
          button: 'var(--app-accent, #7b6cf6)',
          buttonText: 'var(--app-accent-text, #ffffff)',
          'button-text': 'var(--app-accent-text, #ffffff)',
          secondaryBg: 'var(--app-surface-2, #1e1e26)',
          'secondary-bg': 'var(--app-surface-2, #1e1e26)',
          elevated: 'var(--app-elevated, #26262f)',
          border: 'var(--app-border, rgba(255,255,255,0.08))',
          headerBg: 'var(--app-bg, #0a0a0f)',
          'header-bg': 'var(--app-bg, #0a0a0f)',
          accentText: 'var(--app-link, #9d8cff)',
          'accent-text': 'var(--app-link, #9d8cff)',
          sectionBg: 'var(--app-surface, #15151b)',
          'section-bg': 'var(--app-surface, #15151b)',
          sectionHeader: 'var(--app-section-header, #6a6a74)',
          'section-header': 'var(--app-section-header, #6a6a74)',
          subtitleText: 'var(--app-hint, #8a8a94)',
          'subtitle-text': 'var(--app-hint, #8a8a94)',
          destructiveText: 'var(--app-danger, #ff6b6b)',
          'destructive-text': 'var(--app-danger, #ff6b6b)',
        },
        // Vibrant accent palette (reference image asosida)
        accent: {
          lime: '#d6f84c',
          violet: '#8e7bf5',
          pink: '#f26fb2',
          blue: '#5b8def',
          cyan: '#46d9c7',
          amber: '#f5b544',
        },
        // Brand (violet-indigo)
        brand: {
          50: '#f0eefe',
          100: '#e1dcfd',
          200: '#c7bdfb',
          300: '#a896f7',
          400: '#8e7bf5',
          500: '#7b6cf6',
          600: '#6a52ec',
          700: '#5a40d4',
          800: '#4a36ab',
          900: '#3e308a',
          950: '#251c52',
        },
      },
      fontFamily: {
        sans: [
          'Manrope',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: ['SF Mono', 'Monaco', 'Cascadia Code', 'monospace'],
      },
      borderRadius: {
        '4xl': '1.75rem',
        '5xl': '2.25rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.4), 0 10px 30px -12px rgba(0,0,0,0.6)',
        'glow-violet': '0 10px 36px -10px rgba(123,108,246,0.55)',
        'glow-lime': '0 10px 36px -10px rgba(214,248,76,0.45)',
        'glow-pink': '0 10px 36px -10px rgba(242,111,178,0.45)',
        'glow-blue': '0 10px 36px -10px rgba(91,141,239,0.5)',
        'glow-cyan': '0 10px 36px -10px rgba(70,217,199,0.45)',
        'glow-amber': '0 10px 36px -10px rgba(245,181,68,0.45)',
      },
      backgroundImage: {
        'hero-violet': 'linear-gradient(135deg, #7c6cf6 0%, #5b8def 100%)',
        'hero-mesh':
          'radial-gradient(120% 120% at 0% 0%, #8e7bf5 0%, #6a52ec 45%, #5b8def 100%)',
      },
      animation: {
        'slide-up': 'slide-up 0.28s cubic-bezier(0.16,1,0.3,1)',
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-in': 'scale-in 0.22s cubic-bezier(0.16,1,0.3,1)',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        float: 'float 4s ease-in-out infinite',
      },
      keyframes: {
        'slide-up': {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
    },
  },
  plugins: [],
};
