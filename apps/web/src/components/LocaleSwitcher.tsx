import { availableLocales } from '../i18n';
import { useTranslation } from '../hooks/useTranslation';

export function LocaleSwitcher(): JSX.Element {
  const { locale, setLocale } = useTranslation();

  return (
    <select
      aria-label="Select locale"
      className="bg-background border border-border rounded-lg px-2 h-10 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all duration-150"
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
