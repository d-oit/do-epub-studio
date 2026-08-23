import { useTranslation } from '../../hooks/useTranslation';
import { AppLogo } from '../../components/ui';
import { APP_NAME, APP_VERSION_LABEL } from '../../config/app-identity';
import { resolveHelpUrl } from '../../config/demo-config';

/** Value-prop bullets shared by the compact mobile info panel. */
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

/**
 * Desktop-only editorial hero for the split-screen login. Rendered on the
 * paper-grain left panel at `lg` and up: eyebrow brand, a serif headline,
 * and a short lede above the sign-in form.
 */
export function LoginHero() {
  const { t } = useTranslation();
  const helpLink = resolveHelpUrl();

  return (
    <div className="flex w-full flex-col justify-center px-10 py-16 sm:px-14 lg:px-16">
      <div className="flex items-center gap-3">
        <AppLogo size={40} className="shrink-0 text-accent" />
        <p className="eyebrow text-sm font-medium uppercase tracking-[0.2em] text-foreground-muted">
          {APP_NAME}
        </p>
      </div>

      <h1 className="mt-8 text-balance-tight font-display text-4xl font-semibold leading-[1.1] text-foreground xl:text-6xl">
        {t('login.heroTitle')}
      </h1>

      <p className="mt-5 max-w-md text-base leading-relaxed text-foreground-muted lg:text-lg">
        {t('login.heroBody')}
      </p>

      <p className="mt-12 font-mono text-xs uppercase tracking-[0.18em] text-foreground-muted">
        {APP_VERSION_LABEL}
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
