import { useTranslation } from '../../hooks/useTranslation';
import { AppLogo } from '../../components/ui';

export function LoginCardHeader({ isRecoveryMode, bookSlug }: { isRecoveryMode: boolean; bookSlug: string }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex flex-col items-center mb-6">
        <AppLogo size={48} className="text-accent mb-3" />
        <h2 className="font-display text-xl font-bold text-foreground">
          {isRecoveryMode ? t('login.recoveryTitle') : t('login.subtitle')}
        </h2>
        <div className="mt-2 h-0.5 w-8 rounded-full bg-accent/40" />
      </div>

      {bookSlug && (
        <p className="text-foreground-muted text-xs text-center mb-4">
          {t('login.bookSlugLabel')}: <span className="font-semibold text-foreground">{bookSlug}</span>
        </p>
      )}
    </>
  );
}
