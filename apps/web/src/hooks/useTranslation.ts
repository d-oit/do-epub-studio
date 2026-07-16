import { useMemo } from 'react';

import { translate, type TranslationKeys } from '../i18n';
import { useLocaleStore, type SupportedLocale } from '../stores/locale';

export type TFunction = (key: TranslationKeys, params?: Record<string, string | number>) => string;

export function useTranslation(): {
  t: TFunction;
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
} {
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);

  const t = useMemo(() => {
    return (key: TranslationKeys, params?: Record<string, string | number>): string => translate(key, locale, params);
  }, [locale]);

  return { t, locale, setLocale };
}
