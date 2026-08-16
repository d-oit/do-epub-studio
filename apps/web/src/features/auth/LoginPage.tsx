import React, { useActionState, useEffect, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { Button, Input, AppLogo } from '../../components/ui';
import { ThemeToggle } from '../../components/ThemeToggle';
import { APP_NAME, APP_VERSION_LABEL, APP_DESCRIPTION } from '../../config/app-identity';
import { isDemoLoginEnabled, resolveHelpUrl, DEMO_READER_EMAIL, DEMO_READER_PASSWORD, DEMO_BOOK_SLUG } from '../../config/demo-config';

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

function SubmitButton({ children, loadingLabel }: { children: React.ReactNode; loadingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" isLoading={pending} loadingLabel={loadingLabel}>
      {children}
    </Button>
  );
}

function TokenVerifyingView() {
  const { t } = useTranslation();
  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full bg-background-secondary rounded-xl shadow-lg p-8 text-center">
        <p className="text-foreground-muted">{t('login.verifyingToken')}</p>
      </div>
    </div>
  );
}

function TokenErrorView({ error }: { error: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full bg-background-secondary rounded-xl shadow-lg p-8 text-center space-y-4">
        <p className="text-accent-error" role="alert">{error}</p>
        <Button
          onClick={() => {
            // eslint-disable-next-line i18next/no-literal-string -- route path
            void navigate('/login');
          }}
        >
          {t('login.backToLogin')}
        </Button>
      </div>
    </div>
  );
}

interface FormAction {
  (fd: FormData): void;
}

function LoginForm({ action, onRecovery }: { action: FormAction; onRecovery: () => void }) {
  const { t } = useTranslation();
  return (
    <form action={action} noValidate>
      <div className="space-y-4">
        <Input
          id="email"
          label={t('login.emailLabel')}
          type="email"
          name="email" /* eslint-disable-line i18next/no-literal-string -- form field name */
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
            name="password" /* eslint-disable-line i18next/no-literal-string -- form field name */
            autoComplete="current-password"
            placeholder={t('login.passwordPlaceholder')}
          />
          <button
            type="button"
            onClick={onRecovery}
            className="mt-1 text-xs text-accent hover:opacity-80 underline underline-offset-2 transition-colors"
          >
            {t('login.forgotPassword')}
          </button>
        </div>

        <SubmitButton loadingLabel={t('login.signingIn')}>
          {t('login.submit')}
        </SubmitButton>
      </div>
    </form>
  );
}

function RecoveryForm({ action, onBack }: { action: FormAction; onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <form action={action}>
      <div className="space-y-4">
        <p className="text-sm text-foreground-muted mb-4">
          {t('login.recoveryInstructions')}
        </p>
        <Input
          id="email"
          label={t('login.emailLabel')}
          type="email"
          name="email" /* eslint-disable-line i18next/no-literal-string -- form field name */
          required
          autoComplete="email"
        />

        <SubmitButton loadingLabel={t('login.signingIn')}>
          {t('login.sendMagicLink')}
        </SubmitButton>

        <div className="text-center mt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
          >
            {t('login.backToLogin')}
          </Button>
        </div>
      </div>
    </form>
  );
}

function RecoverySuccessView({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="text-center">
      <div className="mb-6 p-4 bg-accent-success/10 border border-accent-success/20 rounded text-sm text-accent-success">
        {t('login.recoverySuccess')}
      </div>
      <Button
        variant="ghost"
        onClick={onBack}
      >
        {t('login.backToLogin')}
      </Button>
    </div>
  );
}

function DemoLoginBlock({ loading, error, onLogin }: { loading: boolean; error: string | null; onLogin: () => void }) {
  const { t } = useTranslation();
  if (!isDemoLoginEnabled()) return null;
  return (
    <div className="mt-4">
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-4 p-3 bg-accent-error/10 border border-accent-error/30 rounded-lg text-sm text-accent-error"
        >
          {error}
        </div>
      )}
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        isLoading={loading}
        loadingLabel={t('login.demoSigningIn')}
        onClick={onLogin}
      >
        {t('login.demoReader')}
      </Button>
      <p className="mt-2 text-xs text-foreground-muted text-center">
        {t('login.demoInfo', { email: DEMO_READER_EMAIL, password: DEMO_READER_PASSWORD, slug: DEMO_BOOK_SLUG })}
      </p>
    </div>
  );
}

function toAuthStorePayload(data: SessionResponse, email: string) {
  return {
    sessionToken: data.sessionToken,
    sessionExpiresAt: data.expiresAt ? new Date(data.expiresAt).getTime() : null,
    bookId: data.book.id,
    bookSlug: data.book.slug,
    bookTitle: data.book.title,
    email,
    capabilities: data.capabilities,
  };
}

function useDemoLogin() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<SessionResponse>('/api/demo/reader-login', {
        method: 'POST',
      });
      setAuth(toAuthStorePayload(data, ''));
      void navigate(`/read/${data.book.slug}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, login };
}

function LoginCardHeader({ isRecoveryMode, bookSlug }: { isRecoveryMode: boolean; bookSlug: string }) {
  const { t } = useTranslation();
  return (
    <>
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
    </>
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
  const demo = useDemoLogin();

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

        setAuth(toAuthStorePayload(data, email));
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
        setAuth(toAuthStorePayload(data, ''));
        void navigate(`/read/${data.book.slug}`);
      } catch (err) {
        if (!cancelledRef.value) setVerifyError((err as Error).message);
      } finally {
        if (!cancelledRef.value) setIsVerifying(false);
      }
    })();
    return () => { cancelledRef.value = true; };
  }, [recoveryToken, navigate, setAuth]);

  const helpLink = useMemo(() => resolveHelpUrl(), []);

  const formError = isRecoveryMode ? recoveryState.error : loginState.error;
  const isRecoverySuccess = isRecoveryMode && recoveryState.success;

  if (recoveryToken && isVerifying) {
    return <TokenVerifyingView />;
  }

  if (recoveryToken && verifyError) {
    return <TokenErrorView error={verifyError} />;
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
        className="mx-auto grid min-h-[calc(100dvh-3rem)] w-full max-w-6xl items-start gap-8 pt-16 pb-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(22rem,28rem)] lg:gap-12"
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
          <LoginCardHeader isRecoveryMode={isRecoveryMode} bookSlug={bookSlug} />

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
            <RecoverySuccessView onBack={() => setIsRecoveryMode(false)} />
          ) : isRecoveryMode ? (
            <RecoveryForm action={recoveryAction} onBack={() => setIsRecoveryMode(false)} />
          ) : (
            <LoginForm action={loginAction} onRecovery={() => setIsRecoveryMode(true)} />
          )}

          {!isRecoveryMode && (
            <DemoLoginBlock
              loading={demo.loading}
              error={demo.error}
              onLogin={() => { void demo.login(); }}
            />
          )}

          <div className="mt-6 pt-4 border-t border-border text-center space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void navigate('/admin/login') /* eslint-disable-line i18next/no-literal-string -- route path */}
              className="text-foreground-muted hover:text-foreground text-sm"
            >
              {t('login.adminLink')}
            </Button>
            <p className="text-xs text-foreground-muted">
              {t('login.adminDescription')}
            </p>
          </div>

          {helpLink && (
            <div className="mt-4 text-center">
              <a
                href={helpLink.href}
                target={helpLink.isExternal ? '_blank' : undefined}
                rel={helpLink.isExternal ? 'noopener noreferrer' : undefined}
                className="text-sm text-accent hover:opacity-80 underline underline-offset-2 transition-colors font-medium"
              >
                {t('login.helpLink')}
              </a>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
