import { useTranslation } from '../../hooks/useTranslation';
import { AppLogo } from '../../components/ui';
import { APP_NAME, APP_VERSION_LABEL } from '../../config/app-identity';
import { resolveHelpUrl } from '../../config/demo-config';

/** Value-prop bullets shared by the desktop hero and the compact mobile info panel. */
export const LOGIN_FEATURE_KEYS = [
  'login.hero.feature.reading',
  'login.hero.feature.annotations',
  'login.hero.feature.offline',
  'login.hero.feature.management',
] as const;

function CheckMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="mt-0.5 h-4 w-4 shrink-0 text-accent"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/**
 * Feature bullet list for the login screens. `compact` renders the
 * small-screen variant (tighter leading, smaller text).
 */
export function LoginFeatureList({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <ul className={compact ? 'space-y-2' : 'space-y-3'}>
      {LOGIN_FEATURE_KEYS.map((key) => (
        <li key={key} className={`flex items-start gap-2.5 ${compact ? 'text-xs' : 'text-sm'}`}>
          <CheckMark />
          <span className="text-foreground">{t(key)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Desktop-only left panel: brand, value props, access note, help link. */
export function LoginHero() {
  const { t } = useTranslation();
  const helpLink = resolveHelpUrl();

  return (
    <div className="max-w-xl">
      <AppLogo size={72} className="mb-6 text-accent" />
      <p className="mb-3 text-sm font-medium tracking-[0.12em] text-foreground-muted">
        {APP_VERSION_LABEL}
      </p>
      <h1 className="text-balance font-display text-5xl font-bold leading-tight text-foreground xl:text-6xl">
        {APP_NAME}
      </h1>

      <div className="mt-8">
        <LoginFeatureList />
      </div>

      <p className="mt-8 max-w-md rounded-lg border border-border bg-background-secondary p-4 text-sm leading-relaxed text-foreground-muted">
        {t('login.hero.howAccessWorks')}
      </p>

      {helpLink && (
        <a
          href={helpLink.href}
          target={helpLink.isExternal ? '_blank' : undefined}
          rel={helpLink.isExternal ? 'noopener noreferrer' : undefined}
          className="mt-4 inline-block text-sm font-medium text-accent underline underline-offset-4 transition-opacity hover:opacity-80"
        >
          {t('login.hero.learnMore')}
        </a>
      )}
    </div>
  );
}
