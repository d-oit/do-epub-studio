import React, { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { Button, Input, AppLogo } from '../../components/ui';
import { ThemeToggle } from '../../components/ThemeToggle';
import { APP_NAME, APP_VERSION_LABEL, APP_DESCRIPTION } from '../../config/app-identity';

interface SessionCapabilities {
  canRead: boolean;
  canComment: boolean;
  canHighlight: boolean;
  canBookmark: boolean;
  canDownloadOffline: boolean;
  canExportNotes: boolean;
  canManageAccess: boolean;
}

interface SessionResponse {
  sessionToken: string;
  expiresAt?: string;
  book: { id: string; slug: string; title: string; authorName: string };
  capabilities: SessionCapabilities | null;
}

interface AuthState {
  error: string | null;
  success: boolean;
}

function LoginSubmitButton({ children, loadingLabel }: { children: React.ReactNode; loadingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" isLoading={pending} loadingLabel={loadingLabel}>
      {children}
    </Button>
  );
}

function RecoverySubmitButton({ children, loadingLabel }: { children: React.ReactNode; loadingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" isLoading={pending} loadingLabel={loadingLabel}>
      {children}
    </Button>
  );
}

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const bookSlug = searchParams.get('book') || '';
  const recoveryToken = searchParams.get('token');

  const [loginState, loginAction] = useActionState<AuthState, FormData>(
    async (_prev, fd) => {
      function getString(name: string): string {
        const v = fd.get(name);
        return typeof v === 'string' ? v : '';
      }
      const email = getString('email');
      const password = getString('password');
      try {
        const data = await apiRequest<SessionResponse>(
          '/api/access/request',
          {
            method: 'POST',
            body: JSON.stringify({ email, password, bookSlug }),
          },
        );

        setAuth({
          sessionToken: data.sessionToken,
          sessionExpiresAt: data.expiresAt ? new Date(data.expiresAt).getTime() : null,
          bookId: data.book.id,
          bookSlug: data.book.slug,
          bookTitle: data.book.title,
          email,
          capabilities: data.capabilities,
        });
        void navigate(`/read/${data.book.slug}`);
        return { error: null, success: true };
      } catch (err) {
        return { error: (err as Error).message, success: false };
      }
    },
    { error: null, success: false },
  );

  const [recoveryState, recoveryAction] = useActionState<AuthState, FormData>(
    async (_prev, fd) => {
      const v = fd.get('email');
      const email = typeof v === 'string' ? v : '';
      try {
        await apiRequest('/api/access/recovery-request', {
          method: 'POST',
          body: JSON.stringify({ email, bookSlug }),
        });
        return { error: null, success: true };
      } catch (err) {
        return { error: (err as Error).message, success: false };
      }
    },
    { error: null, success: false },
  );

  useEffect(() => {
    if (!recoveryToken) return;
    const cancelledRef = { value: false };
    setIsVerifying(true);
    setVerifyError(null);
    void (async () => {
      try {
        const data = await apiRequest<SessionResponse>('/api/access/verify-recovery', {
          method: 'POST',
          body: JSON.stringify({ token: recoveryToken }),
        });
        if (cancelledRef.value) return;
        setAuth({
          sessionToken: data.sessionToken,
          sessionExpiresAt: data.expiresAt ? new Date(data.expiresAt).getTime() : null,
          bookId: data.book.id,
          bookSlug: data.book.slug,
          bookTitle: data.book.title,
          email: '',
          capabilities: data.capabilities,
        });
        void navigate(`/read/${data.book.slug}`);
      } catch (err) {
        if (!cancelledRef.value) setVerifyError((err as Error).message);
      } finally {
        if (!cancelledRef.value) setIsVerifying(false);
      }
    })();
    return () => { cancelledRef.value = true; };
  }, [recoveryToken, navigate, setAuth]);

  const formError = isRecoveryMode ? recoveryState.error : loginState.error;
  const isRecoverySuccess = isRecoveryMode && recoveryState.success;

  if (recoveryToken && isVerifying) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full bg-background-secondary rounded-xl shadow-lg p-8 text-center">
          <p className="text-foreground-muted">{t('login.verifyingToken')}</p>
        </div>
      </div>
    );
  }

  if (recoveryToken && verifyError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full bg-background-secondary rounded-xl shadow-lg p-8 text-center space-y-4">
          <p className="text-accent-error" role="alert">{verifyError}</p>
          <Button
            onClick={() => {
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              navigate('/login');
            }}
          >
            {t('login.backToLogin')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="fixed right-3 top-3 z-20 flex items-center gap-2 sm:right-4 sm:top-4">
        <ThemeToggle />
        <LocaleSwitcher />
      </div>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto grid min-h-[calc(100dvh-3rem)] w-full max-w-6xl items-center gap-8 pt-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(22rem,28rem)] lg:gap-12"
      >
        <section className="hidden min-w-0 lg:block">
          <div className="max-w-xl">
            <AppLogo size={72} className="mb-6 text-accent" />
            <p className="mb-3 text-sm font-medium uppercase tracking-[0.12em] text-foreground-muted">
              {APP_VERSION_LABEL}
            </p>
            <h1 className="text-balance font-display text-5xl font-bold leading-tight text-foreground xl:text-6xl">
              {APP_NAME}
            </h1>
            <p className="mt-5 max-w-lg text-lg text-foreground-muted">
              {APP_DESCRIPTION}
            </p>
          </div>
        </section>

        <section className="w-full rounded-lg border border-border bg-background-secondary p-5 shadow-md sm:p-7 lg:p-8">
          <div className="flex flex-col items-center mb-6">
            <AppLogo size={48} className="text-accent mb-3" />
            <h1 className="text-center font-display text-2xl font-bold leading-tight text-foreground lg:hidden">
              {APP_NAME}
            </h1>
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

          {formError && (
            <div
              role="alert"
              aria-live="polite"
              className="mb-6 p-3 bg-accent-error/10 border border-accent-error/30 rounded-lg text-sm text-accent-error"
            >
              {formError}
            </div>
          )}

          {isRecoverySuccess ? (
            <div className="text-center">
              <div className="mb-6 p-4 bg-accent-success/10 border border-accent-success/20 rounded text-sm text-accent-success">
                {t('login.recoverySuccess')}
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setIsRecoveryMode(false);
                }}
              >
                {t('login.backToLogin')}
              </Button>
            </div>
          ) : isRecoveryMode ? (
            <form action={recoveryAction}>
              <div className="space-y-4">
                <p className="text-sm text-foreground-muted mb-4">
                  {t('login.recoveryInstructions')}
                </p>
                <Input
                  id="email"
                  label={t('login.emailLabel')}
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                />

                <RecoverySubmitButton loadingLabel={t('login.signingIn')}>
                  {t('login.sendMagicLink')}
                </RecoverySubmitButton>

                <div className="text-center mt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsRecoveryMode(false)}
                  >
                    {t('login.backToLogin')}
                  </Button>
                </div>
              </div>
            </form>
          ) : (
            <form action={loginAction} noValidate>
              <div className="space-y-4">
                <Input
                  id="email"
                  label={t('login.emailLabel')}
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  placeholder={t('login.emailPlaceholder')}
                />

                <div>
                  <Input
                    id="password"
                    label={t('login.passwordLabel')}
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    placeholder={t('login.passwordPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setIsRecoveryMode(true)}
                    className="mt-1 text-xs text-accent hover:opacity-80 underline underline-offset-2 transition-colors"
                  >
                    {t('login.forgotPassword')}
                  </button>
                </div>

                <LoginSubmitButton loadingLabel={t('login.signingIn')}>
                  {t('login.submit')}
                </LoginSubmitButton>
              </div>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-border text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void navigate('/admin/login')}
              className="text-foreground-muted hover:text-foreground text-sm"
            >
              {t('login.adminLink')}
            </Button>
          </div>
        </section>

        <p className="text-center text-xs text-foreground-muted lg:col-start-2">
          {t('login.adminDescription')}
        </p>
      </main>
    </div>
  );
}
