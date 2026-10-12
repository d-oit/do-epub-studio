import { useTranslation } from '../../hooks/useTranslation';
import { Button } from '../../components/ui';
import { isDemoLoginEnabled } from '../../config/demo-config';

interface AdminDemoBlockProps {
  loading: boolean;
  error: string | null;
  onLogin: () => void;
  onFillCredentials: () => void;
}

/** Demo-admin entry block, extracted from AdminLoginPage (ADR-278 warn zone). */
export function AdminDemoBlock({
  loading,
  error,
  onLogin,
  onFillCredentials,
}: AdminDemoBlockProps) {
  const { t } = useTranslation();
  if (!isDemoLoginEnabled()) return null;
  return (
    <div className="mt-5">
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="eyebrow">{t('admin.login.demoOr')}</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="mt-4 p-3 bg-accent-error/10 border border-accent-error/20 rounded-sm text-sm text-accent-error"
        >
          {error}
        </div>
      )}

      <Button
        type="button"
        variant="primary"
        className="mt-4 w-full"
        isLoading={loading}
        loadingLabel={t('admin.login.demoSigningIn')}
        onClick={onLogin}
      >
        {t('admin.login.demoTry')}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-1 w-full"
        onClick={onFillCredentials}
      >
        {t('admin.login.demoFillCredentials')}
      </Button>
    </div>
  );
}
