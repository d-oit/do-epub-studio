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
  const localeStatus = useLocaleStore((state) => state.localeStatus);
  // `lang`/`dir` describe the content that is rendered, not the choice that was
  // made: while a locale chunk is loading — or after it failed — the tree shows
  // the English fallback, so claiming the selected locale would be a false
  // declaration (WCAG 3.1.1, A9/GOAP-306). The selected locale takes over as
  // soon as its dictionary is the one in use.
  const effectiveLocale: SupportedLocale = localeStatus === 'ready' ? locale : 'en';

  useEffect(() => {
    const html = document.documentElement;
    const prevDir = html.dir;
    const prevLang = html.lang;
    html.dir = RTL_LOCALES.has(effectiveLocale) ? 'rtl' : 'ltr';
    html.lang = effectiveLocale;
    return () => {
      // Restore the attributes we mutated so unmount leaves the document as
      // it was found (GOAP-224 B14: no leaked DOM mutation on teardown).
      html.dir = prevDir;
      html.lang = prevLang;
    };
  }, [effectiveLocale]);
}
