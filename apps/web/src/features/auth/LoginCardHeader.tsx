import { useTranslation } from '../../hooks/useTranslation';
import { AppLogo } from '../../components/ui';
import { APP_NAME } from '../../config/app-identity';

export function LoginCardHeader({ isRecoveryMode, bookSlug }: { isRecoveryMode: boolean; bookSlug: string }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 ring-1 ring-accent/20">
          <AppLogo size={30} className="text-accent" />
        </div>
        <div className="min-w-0 pt-0.5">
          <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
            {APP_NAME}
          </p>
          <h2 className="font-display text-2xl font-bold leading-tight text-foreground">
            {isRecoveryMode ? t('login.recoveryTitle') : t('login.subtitle')}
          </h2>
        </div>
      </div>

      {bookSlug && (
        <p className="mb-5 rounded-lg border border-border bg-background-tertiary/60 px-3 py-2 text-xs text-foreground-muted">
          {t('login.bookSlugLabel')}: <span className="font-semibold text-foreground">{bookSlug}</span>
        </p>
      )}
    </>
  );
}
