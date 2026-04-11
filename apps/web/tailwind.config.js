/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic palette - see docs/design/color-palette.md
        semantic: {
          success: '#00FF00',
          warning: '#FFD700',
          error: '#FF4444',
          info: '#00D1FF',
        },
        // Surface colors per design-system.md
        surface: {
          DEFAULT: '#050505',
          app: '#050505',
          game: '#18181b',
          technical: '#E4E3E0',
        },
        // Primary palette (existing)
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        // Per docs/design/typography.md
        display: ['Anton', 'sans-serif'],
        serif: ['Georgia', 'italic', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Courier New', 'monospace'],
      },
      spacing: {
        // Layout tokens per design-system.md
        hud: '1.5rem', // 24px
        'hud-md': '2.5rem', // 40px
        'hud-lg': '4rem', // 64px
      },
      borderRadius: {
        // Mode-specific radii per design-system.md
        app: '2rem',
        game: '0.125rem',
        technical: '0',
      },
      animation: {
        // Anti-flicker per design-system.md
        'anti-flicker': 'none',
      },
      backdropBlur: {
        refractive: '80px',
      },
    },
  },
  plugins: [],
};
