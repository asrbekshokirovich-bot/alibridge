/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Telegram theme variables (auto-adapt to user's Telegram theme)
        tg: {
          bg: 'var(--tg-theme-bg-color, #ffffff)',
          text: 'var(--tg-theme-text-color, #000000)',
          hint: 'var(--tg-theme-hint-color, #999999)',
          link: 'var(--tg-theme-link-color, #2481cc)',
          button: 'var(--tg-theme-button-color, #2481cc)',
          buttonText: 'var(--tg-theme-button-text-color, #ffffff)',
          secondaryBg: 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
          headerBg: 'var(--tg-theme-header-bg-color, #ffffff)',
          accentText: 'var(--tg-theme-accent-text-color, #2481cc)',
          sectionBg: 'var(--tg-theme-section-bg-color, #ffffff)',
          sectionHeader: 'var(--tg-theme-section-header-text-color, #6d6d71)',
          subtitleText: 'var(--tg-theme-subtitle-text-color, #999999)',
          destructiveText: 'var(--tg-theme-destructive-text-color, #ff3b30)',
        },
        // Brand colors
        brand: {
          50: '#eff8ff',
          100: '#dbeefe',
          200: '#bfe0fe',
          300: '#93cdfd',
          400: '#60aff9',
          500: '#3b8df5',
          600: '#256feb',
          700: '#1d5bd8',
          800: '#1f4caf',
          900: '#1f438a',
          950: '#172b54',
        },
      },
      fontFamily: {
        sans: [
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
      animation: {
        'slide-up': 'slide-up 0.2s ease-out',
        'fade-in': 'fade-in 0.15s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'slide-up': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
