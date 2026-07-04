/* biome-ignore-all lint/correctness/useQwikValidLexicalScope: this project uses React, not Qwik */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { Button, Input, AppLogo } from '../../components/ui';
import { ThemeToggle } from '../../components/ThemeToggle';
import { APP_NAME, APP_VERSION_LABEL } from '../../config/app-identity';
import { logClientEvent } from '../../lib/client-logger';
import { createSpanId, createTraceId } from '@do-epub-studio/shared/src/telemetry';

type Mode = 'request' | 'verify';

export function AdminRecoverPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAdminAuth = useAuthStore((state) => state.setAdminAuth);

  const token = searchParams.get('token');
  const mode: Mode = token ? 'verify' : 'request';

  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    logClientEvent({
      level: 'info',
      event: 'admin.recover.view',
      traceId: createTraceId(),
      spanId: createSpanId(),
      metadata: { mode },
    });
  }, [mode]);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setInfo(null);

    try {
      await apiRequest('/api/admin/recovery-request', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setInfo(t('admin.recover.requestSent'));
    } catch (err) {
      setError((err as Error).message || t('admin.recover.requestFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigate = (path: string): void => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    navigate(path);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiRequest<{ sessionToken: string; email: string }>(
        '/api/admin/recovery-verify',
        {
          method: 'POST',
          body: JSON.stringify({ token, newPassword }),
        },
      );
      setAdminAuth({ sessionToken: data.sessionToken, email: data.email });
      handleNavigate('/admin/books');
    } catch (err) {
      setError((err as Error).message || t('admin.recover.verifyFailed'));
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

      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-8">
        <header className="flex flex-col items-center gap-3">
          <AppLogo />
          <p className="text-sm text-foreground-muted">{APP_NAME} · {APP_VERSION_LABEL}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {mode === 'request' ? t('admin.recover.titleRequest') : t('admin.recover.titleVerify')}
          </h1>
        </header>

        <section className="w-full rounded-lg border border-border bg-surface p-6 shadow-sm">
          {mode === 'request' ? (
            <form onSubmit={(e) => { void handleRequest(e); }} className="space-y-4">
              <p className="text-sm text-foreground-muted">
                {t('admin.recover.requestDescription')}
              </p>
              <Input
                type="email"
                label={t('admin.login.email')}
                value={email}
                onChange={(e) => { setEmail(e.target.value); }}
                required
                autoComplete="email"
                placeholder="admin@example.com"
              />
              {error && (
                <p role="alert" className="text-sm text-destructive">{error}</p>
              )}
              {info && (
                <p role="status" className="text-sm text-accent">{info}</p>
              )}
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? t('admin.recover.sending') : t('admin.recover.sendLink')}
              </Button>
            </form>
          ) : (
            <form onSubmit={(e) => { void handleVerify(e); }} className="space-y-4">
              <p className="text-sm text-foreground-muted">
                {t('admin.recover.verifyDescription')}
              </p>
              <Input
                type="password"
                label={t('admin.recover.newPassword')}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); }}
                required
                autoComplete="new-password"
                minLength={12}
              />
              {error && (
                <p role="alert" className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? t('admin.recover.resetting') : t('admin.recover.resetPassword')}
              </Button>
            </form>
          )}

          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { handleNavigate('/admin/login'); }}
              className="text-sm text-foreground-muted hover:text-foreground underline decoration-accent/30 hover:decoration-accent focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t('admin.recover.backToLogin')}
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
