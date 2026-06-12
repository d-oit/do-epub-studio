import { useMemo } from 'react';
import { usePreferencesStore } from '../stores/preferences';
import { useTranslation } from '../hooks/useTranslation';
import { IconButton } from './ui';

export function ThemeToggle() {
  const theme = usePreferencesStore((s) => s.reader.theme);
  const setTheme = usePreferencesStore((s) => s.setTheme);
  const { t } = useTranslation();

  const resolvedTheme = useMemo(() => {
    if (theme !== 'system') return theme;
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, [theme]);

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <IconButton
      onClick={toggleTheme}
      variant="ghost"
      aria-label={resolvedTheme === 'dark' ? t('theme.toggle.light') : t('theme.toggle.dark')}
      className="w-10 h-10 flex items-center justify-center"
    >
      {resolvedTheme === 'dark' ? (
        // Sun icon for switching to light mode
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"
          />
        </svg>
      ) : (
        // Moon icon for switching to dark mode
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </IconButton>
  );
}
