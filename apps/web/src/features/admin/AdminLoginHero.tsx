import { useTranslation } from '../../hooks/useTranslation';
import { AppLogo } from '../../components/ui';
import { APP_NAME, APP_DESCRIPTION } from '../../config/app-identity';
import { resolveHelpUrl } from '../../config/demo-config';

/** Admin value-prop bullets shared by the desktop hero and mobile info panel. */
export const ADMIN_FEATURE_KEYS = [
  'admin.login.hero.feature.books',
  'admin.login.hero.feature.grants',
  'admin.login.hero.feature.audit',
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
 * Admin feature bullet list for the admin login screen. `compact` renders
 * the small-screen variant.
 */
export function AdminFeatureList({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <ul className={compact ? 'space-y-2' : 'space-y-3'}>
      {ADMIN_FEATURE_KEYS.map((key) => (
        <li key={key} className={`flex items-start gap-2.5 ${compact ? 'text-xs' : 'text-sm'}`}>
          <CheckMark />
          <span className="text-foreground">{t(key)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Desktop-only left panel for the admin login: brand, value props, access note. */
export function AdminLoginHero() {
  const { t } = useTranslation();
  const helpLink = resolveHelpUrl();

  return (
    <div className="max-w-xl">
      <AppLogo size={72} className="mb-6 text-accent" />
      <h1 className="text-balance font-display text-6xl font-bold leading-tight text-foreground xl:text-7xl">
        {APP_NAME}
      </h1>
      <div className="mt-4 h-1 w-16 rounded-full bg-accent" />
      <p className="mt-5 max-w-lg text-lg text-foreground-muted">
        {APP_DESCRIPTION}
      </p>

      <div className="mt-8">
        <AdminFeatureList />
      </div>

      <p className="mt-8 max-w-md glass-card p-4 text-sm leading-relaxed text-foreground-muted">
        {t('admin.login.howAccessWorks')}
      </p>

      {helpLink && (
        <a
          href={helpLink.href}
          target={helpLink.isExternal ? '_blank' : undefined}
          rel={helpLink.isExternal ? 'noopener noreferrer' : undefined}
          className="mt-4 inline-block text-sm font-medium text-accent underline underline-offset-4 transition-opacity hover:opacity-80"
        >
          {t('admin.login.hero.learnMore')}
        </a>
      )}
    </div>
  );
}

/** Compact admin info shown above the login card on screens below `lg`. */
export function AdminMobileInfo() {
  const { t } = useTranslation();
  return (
    <div className="glass-card p-5 lg:hidden">
      <div className="flex items-center gap-3">
        <AppLogo size={32} className="shrink-0 text-accent" />
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold leading-tight text-foreground">
            {APP_NAME}
          </h1>
          <p className="mt-0.5 truncate text-xs text-foreground-muted">
            {APP_DESCRIPTION}
          </p>
        </div>
      </div>
      <div className="mt-4 border-t border-border pt-4">
        <AdminFeatureList compact />
      </div>
      <p className="mt-4 text-xs leading-relaxed text-foreground-muted">
        {t('admin.login.howAccessWorks')}
      </p>
    </div>
  );
}
