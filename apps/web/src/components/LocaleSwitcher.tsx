import { availableLocales } from '../i18n';
import { useTranslation } from '../hooks/useTranslation';

export function LocaleSwitcher(): JSX.Element {
  const { locale, setLocale } = useTranslation();

  return (
    <select
      aria-label="Select locale"
      className="bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm"
      value={locale}
      onChange={(event) => setLocale(event.target.value as typeof locale)}
    >
      {availableLocales().map(({ code, label }) => (
        <option key={code} value={code}>
          {label}
        </option>
      ))}
    </select>
  );
}
