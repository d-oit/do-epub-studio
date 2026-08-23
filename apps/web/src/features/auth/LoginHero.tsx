import { useTranslation } from '../../hooks/useTranslation';
import { AppLogo } from '../../components/ui';
import { APP_NAME, APP_VERSION_LABEL } from '../../config/app-identity';
import { resolveHelpUrl } from '../../config/demo-config';

/** Value-prop bullets shown in the collapsible "about" section. */
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

/** Feature bullet list shown in the login "about" section. */
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
 * The collapsible "what is this?" content rendered inside the login page's
 * native `details` disclosure. Compact single column: eyebrow brand, a serif
 * headline, a short lede, the feature bullets, the access note, version, and
 * the help link.
 */
export function LoginHero() {
  const { t } = useTranslation();
  const helpLink = resolveHelpUrl();

  return (
    <div className="flex w-full flex-col gap-5 pt-5">
      <div>
        <div className="flex items-center gap-3">
          <AppLogo size={28} className="shrink-0 text-accent" />
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-foreground-muted">
            {APP_NAME}
          </p>
        </div>

        <h1 className="mt-4 text-balance-tight font-display text-2xl font-semibold leading-[1.15] text-foreground sm:text-3xl">
          {t('login.heroTitle')}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-foreground-muted sm:text-base">
          {t('login.heroBody')}
        </p>
      </div>

      <div className="border-t border-border pt-4">
        <LoginFeatureList compact />
      </div>

      <p className="text-xs leading-relaxed text-foreground-muted">
        {t('login.hero.howAccessWorks')}
      </p>

      <div className="flex items-center justify-between text-xs text-foreground-muted">
        <span className="font-mono uppercase tracking-[0.18em]">{APP_VERSION_LABEL}</span>
        {helpLink && (
          <a
            href={helpLink.href}
            target={helpLink.isExternal ? '_blank' : undefined}
            rel={helpLink.isExternal ? 'noopener noreferrer' : undefined}
            className="text-sm font-medium text-accent underline underline-offset-4 transition-opacity hover:opacity-80"
          >
            {t('login.hero.learnMore')}
          </a>
        )}
      </div>
    </div>
  );
}
