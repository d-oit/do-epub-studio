import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { Button, Input, AppLogo } from '../../components/ui';
import { ThemeToggle } from '../../components/ThemeToggle';
import { APP_NAME, APP_VERSION_LABEL } from '../../config/app-identity';

export function AdminLoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setAdminAuth = useAuthStore((state) => state.setAdminAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiRequest<{ sessionToken: string; email: string }>(
        '/api/admin/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        },
      );

      setAdminAuth({ sessionToken: data.sessionToken, email: data.email });
      void navigate('/admin/books');
    } catch (err) {
      setError((err as Error).message || t('admin.login.invalidCredentials'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="fixed right-3 top-3 z-20 flex items-center gap-2 sm:right-4 sm:top-4">
        <ThemeToggle />
        <LocaleSwitcher />
      </div>

      <main
        id="main-content"
        className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-md items-center pt-16"
      >
      <section className="w-full rounded-lg border border-border bg-background-secondary p-5 shadow-md sm:p-7 lg:p-8">
        <div className="text-center mb-8">
          <AppLogo size={44} className="mx-auto mb-3 text-accent" />
          <h1 className="text-2xl font-bold text-foreground">
            {t('admin.login.title')}
          </h1>
          <p className="text-foreground-muted mt-2 text-sm">
            {APP_NAME} {t('admin.login.managementLabel')} · {APP_VERSION_LABEL}
          </p>
        </div>

        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-6 p-3 bg-accent-error/10 border border-accent-error/20 rounded text-sm text-accent-error"
          >
            {error}
          </div>
        )}

        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <div className="space-y-4">
            <Input
              id="email"
              label={t('admin.login.email')}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Input
              id="password"
              label={t('admin.login.password')}
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              loadingLabel={t('admin.login.signingIn')}
            >
              {t('admin.login.signIn')}
            </Button>
          </div>
        </form>

        <div className="mt-4 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { void navigate('/admin/recover'); /* eslint-disable-line i18next/no-literal-string -- route path */ }}
            className="text-sm text-foreground-muted hover:text-foreground underline decoration-accent/30 hover:decoration-accent focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t('admin.login.forgotPassword')}
          </Button>
        </div>

        <div className="mt-8 pt-6 border-t border-border text-center space-y-3">
          <p className="text-sm text-foreground-muted">
            {t('admin.login.readerDescription')}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { void navigate('/login'); /* eslint-disable-line i18next/no-literal-string -- route path */ }}
            className="underline decoration-accent/30 hover:decoration-accent focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t('admin.login.backToReader')}
          </Button>
        </div>
      </section>
      </main>
    </div>
  );
}
