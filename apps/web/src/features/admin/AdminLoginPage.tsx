import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { startAuthentication, type PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { Button, Input, AppLogo } from '../../components/ui';
import { ThemeToggle } from '../../components/ThemeToggle';
import { APP_NAME, APP_VERSION_LABEL } from '../../config/app-identity';
import { isDemoLoginEnabled, resolveHelpUrl } from '../../config/demo-config';

interface AdminUser {
  id: string;
  email: string;
  role: string;
}

interface AdminLoginResponse {
  token?: string;
  user: AdminUser;
  mfaRequired?: boolean;
  loginTicket?: string;
}

type LoginStep = 'credentials' | 'mfa';
type MfaMode = 'passkey' | 'recovery';

export function AdminLoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setAdminAuth = useAuthStore((state) => state.setAdminAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<LoginStep>('credentials');
  const [mfaMode, setMfaMode] = useState<MfaMode | null>(null);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [loginTicket, setLoginTicket] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  const completeSignIn = (data: { token: string; user: AdminUser }) => {
    setAdminAuth({ sessionToken: data.token, email: data.user.email });
    void navigate('/admin/books');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiRequest<AdminLoginResponse>(
        '/api/admin/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        },
      );

      if (data.mfaRequired) {
        // ADR-234: an enrolled account requires a second factor before a
        // session exists. Keep the factor-1 login ticket (password proof) to
        // present at /login/mfa/*; pre-fill recovery email + password.
        setLoginTicket(data.loginTicket ?? null);
        setRecoveryEmail(data.user.email);
        setRecoveryPassword(password);
        setMfaMode(null);
        setRecoveryCode('');
        setStep('mfa');
        return;
      }

      if (!data.token) {
        throw new Error('No session token returned');
      }
      completeSignIn({ token: data.token, user: data.user });
    } catch (err) {
      setError((err as Error).message || t('admin.login.invalidCredentials'));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasskey = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (!loginTicket) {
        throw new Error('MFA login requires a verified password first');
      }
      const start = await apiRequest<{ options: PublicKeyCredentialRequestOptionsJSON }>(
        '/api/admin/login/mfa/start',
        {
          method: 'POST',
          body: JSON.stringify({ loginTicket }),
        },
      );

      const response = await startAuthentication({ optionsJSON: start.options });
      const data = await apiRequest<AdminLoginResponse>(
        '/api/admin/login/mfa/verify',
        {
          method: 'POST',
          body: JSON.stringify({ loginTicket, authenticationResponse: response }),
        },
      );

      if (!data.token) {
        throw new Error('No session token returned');
      }
      completeSignIn({ token: data.token, user: data.user });
    } catch (err) {
      setError((err as Error).message || t('admin.login.invalidCredentials'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiRequest<AdminLoginResponse>(
        '/api/admin/login/mfa/recovery-verify',
        {
          method: 'POST',
          body: JSON.stringify({
            email: recoveryEmail,
            password: recoveryPassword,
            recoveryCode,
          }),
        },
      );

      if (!data.token) {
        throw new Error('No session token returned');
      }
      completeSignIn({ token: data.token, user: data.user });
    } catch (err) {
      setError((err as Error).message || t('admin.login.invalidCredentials'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    setDemoError(null);
    try {
      const data = await apiRequest<AdminLoginResponse>('/api/demo/admin-login', {
        method: 'POST',
      });
      if (!data.token) {
        throw new Error('No session token returned');
      }
      completeSignIn({ token: data.token, user: data.user });
    } catch (err) {
      setDemoError((err as Error).message || t('admin.login.invalidCredentials'));
    } finally {
      setDemoLoading(false);
    }
  };

  const helpLink = useMemo(() => resolveHelpUrl(), []);

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

        {step === 'credentials' ? (
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
        ) : (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {t('admin.login.mfaTitle')}
              </h2>
              <p className="mt-1 text-sm text-foreground-muted">
                {t('admin.login.mfaDescription')}
              </p>
            </div>

            {mfaMode === null && (
              <div className="space-y-3">
                <Button
                  type="button"
                  className="w-full"
                  isLoading={isLoading}
                  loadingLabel={t('admin.login.signingIn')}
                  onClick={() => { void handlePasskey(); }}
                >
                  {t('admin.login.usePasskey')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  disabled={isLoading}
                  onClick={() => { setMfaMode('recovery'); setError(null); }}
                >
                  {t('admin.login.useRecoveryCode')}
                </Button>
              </div>
            )}

            {mfaMode === 'recovery' && (
              <form onSubmit={(e) => { void handleRecovery(e); }}>
                <div className="space-y-4">
                  <Input
                    id="recovery-email"
                    label={t('admin.login.email')}
                    type="email"
                    required
                    autoComplete="email"
                    value={recoveryEmail}
                    readOnly
                  />

                  <Input
                    id="recovery-password"
                    label={t('admin.login.password')}
                    type="password"
                    required
                    autoComplete="current-password"
                    value={recoveryPassword}
                    onChange={(e) => setRecoveryPassword(e.target.value)}
                  />

                  <Input
                    id="recovery-code"
                    label={t('admin.login.recoveryCode')}
                    type="text"
                    required
                    autoComplete="one-time-code"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    isLoading={isLoading}
                    loadingLabel={t('admin.login.signingIn')}
                  >
                    {t('admin.login.verifyRecovery')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => { setMfaMode(null); }}
                    disabled={isLoading}
                  >
                    {t('admin.login.back')}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {demoError && (
          <div
            role="alert"
            aria-live="polite"
            className="mt-4 p-3 bg-accent-error/10 border border-accent-error/20 rounded text-sm text-accent-error"
          >
            {demoError}
          </div>
        )}

        {isDemoLoginEnabled() && step === 'credentials' && (
          <div className="mt-4">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              isLoading={demoLoading}
              loadingLabel={t('admin.login.demoSigningIn')}
              onClick={() => { void handleDemoLogin(); }}
            >
              {t('admin.login.demoAdmin')}
            </Button>
          </div>
        )}

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

        {helpLink && (
          <div className="mt-3 text-center">
            <a
              href={helpLink.href}
              target={helpLink.isExternal ? '_blank' : undefined}
              rel={helpLink.isExternal ? 'noopener noreferrer' : undefined}
              className="text-xs text-accent hover:opacity-80 underline underline-offset-2 transition-colors"
            >
              {t('admin.login.helpLink')}
            </a>
          </div>
        )}
      </section>
      </main>
    </div>
  );
}
