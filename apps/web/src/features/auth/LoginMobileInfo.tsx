import { useTranslation } from '../../hooks/useTranslation';
import { AppLogo } from '../../components/ui';
import { APP_NAME, APP_DESCRIPTION } from '../../config/app-identity';
import { LoginFeatureList } from './LoginHero';

/**
 * Compact app info shown above the login card on screens below `lg`, where
 * the full desktop hero is hidden. Mirrors LoginHero's content in miniature
 * so mobile users still see what the app does before signing in.
 */
export function LoginMobileInfo() {
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
        <LoginFeatureList compact />
      </div>
      <p className="mt-4 text-xs leading-relaxed text-foreground-muted">
        {t('login.hero.howAccessWorks')}
      </p>
    </div>
  );
}
