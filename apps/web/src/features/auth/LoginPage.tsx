import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { Button } from '../../components/ui';
import { ThemeToggle } from '../../components/ThemeToggle';
import { resolveHelpUrl, DEMO_READER_EMAIL, DEMO_READER_PASSWORD } from '../../config/demo-config';
import { LoginHero, LoginFeatureList } from './LoginHero';
import { LoginMobileInfo } from './LoginMobileInfo';
import { LoginForm, RecoveryForm } from './LoginForm';
import { RecoverySuccessView, TokenVerifyingView, TokenErrorView } from './RecoveryViews';
import {
  DemoLoginBlock,
  useDemoLogin,
  toAuthStorePayload,
  type SessionResponse,
} from './DemoLogin';
import { LoginCardHeader } from './LoginCardHeader';

interface AuthState {
  error: string | null;
  success: boolean;
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

  // Uncontrolled FormData inputs: demo autofill writes values directly via
  // refs instead of converting the form to controlled state (ADR-245).
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const fillDemoCredentials = () => {
    if (emailRef.current) emailRef.current.value = DEMO_READER_EMAIL;
    if (passwordRef.current) passwordRef.current.value = DEMO_READER_PASSWORD;
    emailRef.current?.focus();
  };

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
        const data = await apiRequest<SessionResponse>('/api/access/request', {
          method: 'POST',
          body: JSON.stringify({ email, password, bookSlug }),
        });

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
    return () => {
      cancelledRef.value = true;
    };
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
    <div className="relative min-h-dvh overflow-x-clip bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 opacity-70"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 18% 10%, oklch(var(--color-accent) / 0.11), transparent 65%)',
        }}
      />
      <div className="fixed right-4 top-4 z-20 flex items-center gap-2 sm:right-6 sm:top-6">
        <ThemeToggle />
        <LocaleSwitcher />
      </div>

      <main
        id="main-content"
        tabIndex={-1}
        className="lg:grid lg:min-h-dvh lg:grid-cols-[1.1fr_1fr] xl:grid-cols-[1.2fr_1fr]"
      >
        {/* Desktop brand panel — the former collapsible "about" content,
            now always visible (no disclosure interaction required). */}
        <aside className="hidden items-stretch border-e border-border bg-background-secondary/80 px-10 py-12 shadow-spine backdrop-blur-sm lg:flex xl:px-16">
          <LoginHero />
        </aside>

        <section className="flex flex-col items-center justify-center px-4 py-16 sm:px-6 lg:px-12">
          <div className="w-full max-w-[26rem]">
            <LoginMobileInfo />

            <section data-testid="login-card" className="glass-card w-full border border-border/80 p-6 shadow-page sm:p-8">
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
                <LoginForm
                  action={loginAction}
                  onRecovery={() => setIsRecoveryMode(true)}
                  emailRef={emailRef}
                  passwordRef={passwordRef}
                  noBookContext={!bookSlug}
                />
              )}

              {!isRecoveryMode && (
                <DemoLoginBlock
                  loading={demo.loading}
                  error={demo.error}
                  onLogin={() => {
                    void demo.login();
                  }}
                  onFillCredentials={fillDemoCredentials}
                />
              )}

              <div className="mt-6 pt-4 border-t border-border text-center space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  /* eslint-disable-next-line i18next/no-literal-string -- route path */
                  onClick={() => void navigate('/admin/login')}
                  className="text-foreground-muted hover:text-foreground text-sm"
                >
                  {t('login.adminLink')}
                </Button>
                <p className="text-xs text-foreground-muted">{t('login.adminDescription')}</p>
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

            <div className="mt-8 lg:hidden" data-testid="login-about">
              <LoginFeatureList compact />
              <p className="mt-4 text-xs leading-relaxed text-foreground-muted">
                {t('login.hero.howAccessWorks')}
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
