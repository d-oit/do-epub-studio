import { useMemo } from 'react';

import { translate, type TranslationKeys } from '../i18n';
import { useLocaleStore, type SupportedLocale } from '../stores/locale';

export function useTranslation(): {
  t: (key: TranslationKeys) => string;
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
} {
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);

  const t = useMemo(() => {
    return (key: TranslationKeys): string => translate(key, locale);
  }, [locale]);

  return { t, locale, setLocale };
}
