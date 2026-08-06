import { useEffect, useMemo, useState } from 'react';

import { ensureLocale, translate, type TranslationKeys } from '../i18n';
import { useLocaleStore, type SupportedLocale } from '../stores/locale';

export type TFunction = (key: TranslationKeys, params?: Record<string, string | number>) => string;

export function useTranslation(): {
  t: TFunction;
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
} {
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);
  // Track which locale is loaded — reset to null on locale change so the
  // component re-renders with fallback text until the async load completes.
  const [loadedLocale, setLoadedLocale] = useState<SupportedLocale | null>(() =>
    locale === 'en' ? 'en' : null,
  );

  useEffect(() => {
    if (locale === 'en') {
      setLoadedLocale('en');
      return;
    }
    // Reset so the component shows fallback text while loading.
    setLoadedLocale(null);
    let cancelled = false;
    void ensureLocale(locale).then(() => {
      if (!cancelled) setLoadedLocale(locale);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const t = useMemo(() => {
    const resolved = loadedLocale === locale ? locale : 'en';
    return (key: TranslationKeys, params?: Record<string, string | number>): string =>
      translate(key, resolved, params);
  }, [locale, loadedLocale]);

  return { t, locale, setLocale };
}
