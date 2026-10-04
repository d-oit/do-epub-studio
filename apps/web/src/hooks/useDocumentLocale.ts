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
    const html = document.documentElement;
    const prevDir = html.dir;
    const prevLang = html.lang;
    html.dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
    html.lang = locale;
    return () => {
      // Restore the attributes we mutated so unmount leaves the document as
      // it was found (GOAP-224 B14: no leaked DOM mutation on teardown).
      html.dir = prevDir;
      html.lang = prevLang;
    };
  }, [locale]);
}
