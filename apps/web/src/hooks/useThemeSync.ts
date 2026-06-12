import { useEffect } from 'react';
import { usePreferencesStore } from '../stores/preferences';

export function useThemeSync() {
  const theme = usePreferencesStore((s) => s.reader.theme);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let active = true;
    const applyTheme = (e?: MediaQueryListEvent | MediaQueryList) => {
      if (!active) return;
      const isSystemDark = e != null && 'matches' in e
        ? e.matches
        : window.matchMedia('(prefers-color-scheme: dark)').matches;
      const resolvedTheme = theme === 'system' ? (isSystemDark ? 'dark' : 'light') : theme;

      const root = document.documentElement;

      // We apply both data-theme and .dark class to support different Tailwind versions/configs
      root.setAttribute('data-theme', resolvedTheme);

      if (resolvedTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }

      // Specifically for sepia if needed, although it's mostly handled by data-theme in globals.css
      if (resolvedTheme === 'sepia') {
        root.classList.add('sepia');
      } else {
        root.classList.remove('sepia');
      }
    };

    applyTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    if (theme === 'system') {
      mediaQuery.addEventListener('change', applyTheme);
    }

    return () => {
      active = false;
      mediaQuery.removeEventListener('change', applyTheme);
    };
  }, [theme]);
}
