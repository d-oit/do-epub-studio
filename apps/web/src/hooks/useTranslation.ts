import { useEffect, useMemo, useState } from 'react';

import { ensureLocale, translate, type TranslationKeys } from '../i18n';
import { useLocaleStore, type SupportedLocale } from '../stores/locale';

export type TFunction = (key: TranslationKeys, params?: Record<string, string | number>) => string;

export function useTranslation(): {
  t: TFunction;
  /** Locale whose dictionary is rendered (falls back to `en` while loading). */
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
} {
  const locale = useLocaleStore((state) => state.locale);
  const localeAttempt = useLocaleStore((state) => state.localeAttempt);
  const setLocale = useLocaleStore((state) => state.setLocale);
  const reportLocaleLoad = useLocaleStore((state) => state.reportLocaleLoad);
  // Track which locale is loaded — reset to null on locale change so the
  // component re-renders with fallback text until the async load completes.
  const [loadedLocale, setLoadedLocale] = useState<SupportedLocale | null>(() =>
    locale === 'en' ? 'en' : null,
  );

  useEffect(() => {
    if (locale === 'en') {
      setLoadedLocale('en');
      reportLocaleLoad('en', true);
      return;
    }
    // Retry of a locale whose chunk already failed *in this document*: a failed
    // dynamic import is cached by the module registry for the document's
    // lifetime (measured: reselecting issues no second request), so re-importing
    // cannot succeed. Reload instead — the choice is persisted, so the fresh
    // document boots straight into the requested locale (A9/GOAP-306).
    // Reset so the component shows fallback text while loading.
    setLoadedLocale(null);
    let cancelled = false;
    // `ensureLocale` reports a failed chunk as `false` instead of rejecting, so
    // this path has no unhandled rejection and the store can say `failed` rather
    // than leaving the document claiming a language that never loaded (A9).
    void ensureLocale(locale).then((loaded) => {
      if (cancelled) return;
      setLoadedLocale(loaded ? locale : null);
      reportLocaleLoad(locale, loaded);
    });
    return () => {
      cancelled = true;
    };
    // `localeAttempt` makes a reselection of the same locale re-run this effect,
    // so a retry really re-attempts the import in the (unlikely) case the module
    // registry allows it; the reload owner handles the poisoned-registry case.
  }, [locale, localeAttempt, reportLocaleLoad]);

  // What the UI actually renders. While a dictionary is loading — or after it
  // failed — the text is English, so callers that format dates/numbers, pick
  // reading direction or paint a language dropdown must see English too, not the
  // choice that has not taken effect (A9/GOAP-306). The requested locale stays
  // in the store for the retry/reload path.
  const effectiveLocale: SupportedLocale = loadedLocale ?? 'en';

  const t = useMemo(
    () =>
      (key: TranslationKeys, params?: Record<string, string | number>): string =>
        translate(key, effectiveLocale, params),
    [effectiveLocale],
  );

  return { t, locale: effectiveLocale, setLocale };
}
