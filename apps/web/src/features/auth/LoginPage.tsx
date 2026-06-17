import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { Button, Input, AppLogo } from '../../components/ui';
import { ThemeToggle } from '../../components/ThemeToggle';

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

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [isRecoverySuccess, setIsRecoverySuccess] = useState(false);

  const bookSlug = searchParams.get('book') || '';
  const recoveryToken = searchParams.get('token');

  const handleVerifyRecovery = React.useCallback(async (token: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiRequest<SessionResponse>(
        '/api/access/verify-recovery',
        {
          method: 'POST',
          body: JSON.stringify({ token }),
        },
      );

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
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [navigate, setAuth]);

  useEffect(() => {
    if (recoveryToken) {
      void handleVerifyRecovery(recoveryToken);
    }
  }, [recoveryToken, handleVerifyRecovery]);

  const handleRecoveryRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await apiRequest(
        '/api/access/recovery-request',
        {
          method: 'POST',
          body: JSON.stringify({ email, bookSlug }),
        },
      );
      setIsRecoverySuccess(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

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
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  if (recoveryToken && isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full bg-background-secondary rounded-xl shadow-lg p-8 text-center">
          <p className="text-foreground-muted">{t('login.verifyingToken')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-4 py-8">
      {/* Top utility bar */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <ThemeToggle />
        <LocaleSwitcher />
      </div>

      {/* Auth card */}
      <main id="main-content" tabIndex={-1} className="max-w-sm w-full bg-background-secondary rounded-xl shadow-lg p-8 border border-border">
        {/* Branding */}
        <div className="flex flex-col items-center mb-6">
          <AppLogo size={48} className="text-accent mb-3" />
          <h1
            className="text-2xl font-bold text-foreground text-center font-display"
          >
            do EPUB Studio
          </h1>
          <p className="text-foreground-muted text-sm mt-1 text-center">
            {isRecoveryMode ? t('login.recoveryTitle') : t('login.subtitle')}
          </p>
        </div>

        {bookSlug && (
          <p className="text-foreground-muted text-xs text-center mb-4">
            {t('login.bookSlugLabel')}: <span className="font-semibold text-foreground">{bookSlug}</span>
          </p>
        )}

        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-6 p-3 bg-accent-error/10 border-l-3 border-accent-error rounded-r text-sm text-accent-error"
          >
            {error}
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
                setIsRecoverySuccess(false);
              }}
            >
              {t('login.backToLogin')}
            </Button>
          </div>
        ) : isRecoveryMode ? (
          <form onSubmit={(e) => { void handleRecoveryRequest(e); }}>
            <div className="space-y-4">
              <p className="text-sm text-foreground-muted mb-4">
                {t('login.recoveryInstructions')}
              </p>
              <Input
                id="email"
                label={t('login.emailLabel')}
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <Button
                type="submit"
                className="w-full"
                isLoading={isLoading}
                loadingLabel={t('login.signingIn')}
              >
                {t('login.sendMagicLink')}
              </Button>

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
          <form onSubmit={(e) => { void handleSubmit(e); }} noValidate>
            <div className="space-y-4">
              <Input
                id="email"
                label={t('login.emailLabel')}
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('login.emailPlaceholder')}
              />

              <div>
                <Input
                  id="password"
                  label={t('login.passwordLabel')}
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

              <Button
                type="submit"
                className="w-full"
                isLoading={isLoading}
                loadingLabel={t('login.signingIn')}
              >
                {t('login.submit')}
              </Button>
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
      </main>

      <p className="mt-6 text-xs text-foreground-muted text-center max-w-sm">
        {t('login.adminDescription')}
      </p>
    </div>
  );
}
