import { useTranslation } from '../../hooks/useTranslation';
import { AppLogo } from '../../components/ui';
import { APP_NAME, APP_VERSION_LABEL } from '../../config/app-identity';
import { resolveHelpUrl } from '../../config/demo-config';

/** Value-prop bullets shown in the brand panel and the compact mobile block. */
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

/** Feature bullet list shown in the brand panel and mobile info block. */
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
 * Desktop (lg+) brand panel: an always-visible editorial column that replaces
 * the former collapsible "about" disclosure. Brand lockup, serif display
 * headline, lede, value props, access note, and help link — no interaction
 * required to see any of it. Entrance is a staggered slide-up-fade; the global
 * prefers-reduced-motion block collapses it to an instant render.
 */
export function LoginHero() {
  const { t } = useTranslation();
  const helpLink = resolveHelpUrl();

  return (
    <div className="flex h-full w-full flex-col justify-between gap-10">
      <div className="flex animate-slide-up-fade items-center gap-3">
        <AppLogo size={28} className="shrink-0 text-accent" />
        <p className="font-medium text-foreground">{APP_NAME}</p>
      </div>

      <div>
        <h1 className="animate-slide-up-fade text-balance-tight font-display text-4xl font-semibold leading-[1.08] text-foreground [animation-delay:80ms] xl:text-[3.4rem]">
          {t('login.heroTitle')}
        </h1>
        <p className="mt-5 max-w-[52ch] animate-slide-up-fade text-base leading-relaxed text-foreground-muted [animation-delay:160ms]">
          {t('login.heroBody')}
        </p>
      </div>

      <div className="animate-slide-up-fade [animation-delay:240ms]">
        <LoginFeatureList />
      </div>

      <div className="animate-slide-up-fade border-t border-border pt-5 [animation-delay:320ms]">
        <p className="text-sm leading-relaxed text-foreground-muted">
          {t('login.hero.howAccessWorks')}
        </p>
        <div className="mt-4 flex items-center justify-between gap-4">
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-foreground-muted">
            {APP_VERSION_LABEL}
          </span>
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
    </div>
  );
}
