import { AppLogo } from '../../components/ui';
import { APP_NAME, APP_DESCRIPTION } from '../../config/app-identity';

/**
 * Slim brand header shown directly on the login page (all viewports, no side
 * panel): app logo, canonical name, and tagline. Mirrors the app's editorial
 * identity so users see what the product is before signing in.
 */
export function LoginMobileInfo() {
  return (
    <div data-testid="login-brand" className="flex items-center gap-3 pb-5 lg:hidden">
      <AppLogo size={32} className="shrink-0 text-accent" />
      <div className="min-w-0">
        <h1 className="font-display text-xl font-bold leading-tight text-foreground">{APP_NAME}</h1>
        <p className="mt-0.5 truncate text-xs text-foreground-muted">{APP_DESCRIPTION}</p>
      </div>
    </div>
  );
}
