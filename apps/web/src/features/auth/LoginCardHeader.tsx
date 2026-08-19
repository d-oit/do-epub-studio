import { useTranslation } from '../../hooks/useTranslation';
import { AppLogo } from '../../components/ui';
import { APP_VERSION_LABEL } from '../../config/app-identity';

export function LoginCardHeader({ isRecoveryMode, bookSlug }: { isRecoveryMode: boolean; bookSlug: string }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex flex-col items-center mb-6">
        <AppLogo size={48} className="text-accent mb-3" />
        <p className="mt-1 text-center text-xs font-medium text-foreground-muted">
          {t('app.versionLabel')} {APP_VERSION_LABEL}
        </p>
        <p className="text-foreground-muted text-sm mt-1 text-center">
          {isRecoveryMode ? t('login.recoveryTitle') : t('login.subtitle')}
        </p>
      </div>

      {bookSlug && (
        <p className="text-foreground-muted text-xs text-center mb-4">
          {t('login.bookSlugLabel')}: <span className="font-semibold text-foreground">{bookSlug}</span>
        </p>
      )}
    </>
  );
}
