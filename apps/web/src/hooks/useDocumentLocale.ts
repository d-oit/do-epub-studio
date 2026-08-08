import { useEffect } from 'react';

import { useLocaleStore, type SupportedLocale } from '../stores/locale';

/** Locales rendered right-to-left. Of the 13 supported catalogs, only Arabic. */
const RTL_LOCALES: ReadonlySet<SupportedLocale> = new Set<SupportedLocale>(['ar']);

/**
 * Keep `<html dir>` and `<html lang>` in sync with the active UI locale so the
 * app shell (and the reader, which reads `document.documentElement.dir` as its
 * default direction) lay out correctly for RTL languages. Call once near the
 * app root (see `App.tsx`).
 */
export function useDocumentLocale(): void {
  const locale = useLocaleStore((state) => state.locale);

  useEffect(() => {
    document.documentElement.dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
  }, [locale]);
}
