/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', '../../packages/ui/src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // NOTE: Tailwind v4 @theme in globals.css is source of truth.
      // This v3 config is kept for reference only — colors use OKLCH in v4.
      colors: {
        background: {
          DEFAULT: 'oklch(100% 0 0)',
          secondary: 'oklch(97% 0 0)',
          tertiary: 'oklch(92% 0 0)',
        },
        foreground: {
          DEFAULT: 'oklch(15% 0 0)',
          muted: 'oklch(50% 0 0)',
        },
        accent: {
          DEFAULT: 'oklch(48% 0.16 250)',
          secondary: 'oklch(54.1% 0.247 293.0)',
          success: 'oklch(70% 0.15 150)',
          warning: 'oklch(75% 0.15 80)',
          error: 'oklch(65% 0.2 25)',
          info: 'oklch(71.5% 0.126 215.2)',
        },
        border: {
          DEFAULT: 'oklch(92% 0 0)',
          light: 'oklch(97% 0 0)',
          dark: 'oklch(26.9% 0 0)',
        },
        muted: {
          DEFAULT: 'oklch(97% 0 0)',
          foreground: 'oklch(55.6% 0 0)',
          dark: 'oklch(26.9% 0 0)',
          'dark-foreground': 'oklch(71.5% 0 0)',
        },
        surface: {
          DEFAULT: 'oklch(14.5% 0 0)',
        },
        primary: {
          50: 'oklch(97.0% 0.014 254.4)',
          100: 'oklch(93.2% 0.032 255.5)',
          200: 'oklch(88.2% 0.057 254.1)',
          300: 'oklch(80.9% 0.096 251.8)',
          400: 'oklch(71.4% 0.143 254.6)',
          500: 'oklch(62.3% 0.188 259.8)',
          600: 'oklch(54.6% 0.215 262.9)',
          700: 'oklch(48.8% 0.217 264.4)',
          800: 'oklch(42.4% 0.181 265.6)',
          900: 'oklch(37.9% 0.138 265.5)',
        },
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'Cambria', 'serif'],
        body: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        hero: ['clamp(2.5rem, 8vw, 4rem)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        title: ['clamp(1.5rem, 4vw, 2rem)', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        subtitle: ['1.25rem', { lineHeight: '1.4' }],
        body: ['1rem', { lineHeight: '1.6' }],
        caption: ['0.875rem', { lineHeight: '1.5' }],
        small: ['0.75rem', { lineHeight: '1.5' }],
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
        30: '7.5rem',
      },
      borderRadius: {
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
        app: '2rem',
        game: '0.125rem',
        technical: '0',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        glass: '0 8px 32px rgba(0, 0, 0, 0.12)',
        'glass-lg': '0 20px 60px rgba(0, 0, 0, 0.15)',
        inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
        none: 'none',
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        DEFAULT: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        '2xl': '40px',
        '3xl': '64px',
        refractive: '80px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'fade-out': 'fadeOut 0.2s ease-in',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-down': 'slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 2s linear infinite',
        'spin-slow': 'spin 3s linear infinite',
        'anti-flicker': 'none',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      transitionTimingFunction: {
        'ease-out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'ease-in-expo': 'cubic-bezier(0.7, 0, 0.84, 0)',
        'ease-out-back': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'ease-in-out-expo': 'cubic-bezier(0.87, 0, 0.13, 1)',
      },
      transitionDuration: {
        50: '50ms',
        150: '150ms',
        250: '250ms',
        350: '350ms',
        400: '400ms',
        450: '450ms',
        600: '600ms',
        800: '800ms',
      },
    },
  },
  plugins: [
    // Add custom utilities for 2026 design patterns
    function ({ addUtilities }) {
      addUtilities({
        '.glass-panel': {
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(24px)',
          borderColor: 'rgba(255, 255, 255, 0.2)',
          borderWidth: '1px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        },
        '.glass-panel-dark': {
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(24px)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: '1px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        },
        '.glass-card': {
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(16px)',
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: '1px',
          borderRadius: '1rem',
          transition: 'all 0.3s ease',
        },
        '.glass-card-dark': {
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(16px)',
          borderColor: 'rgba(255, 255, 255, 0.05)',
          borderWidth: '1px',
          borderRadius: '1rem',
          transition: 'all 0.3s ease',
        },
        '.text-balance': {
          textWrap: 'balance',
        },
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
        '.scrollbar-thin': {
          'scrollbar-width': 'thin',
          '&::-webkit-scrollbar': {
            width: '6px',
            height: '6px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '3px',
          },
        },
        '.focus-ring': {
          outline: 'none',
          ring: '2px',
          ringOffset: '2px',
          ringColor: '#2563eb',
        },
        '.touch-target': {
          minHeight: '44px',
          minWidth: '44px',
        },
      });
    },
  ],
};
