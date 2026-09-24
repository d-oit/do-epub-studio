import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLogo, Button, Input } from '../../components/ui';
import { Spinner } from '@do-epub-studio/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuthStore } from '../../stores/auth';
import { acceptBookInvitation } from '../../lib/api/invitations';
import { APP_NAME } from '../../config/app-identity';

const LOGIN_ROUTE = '/login';
const MAX_INVITATION_TOKEN_LENGTH = 256;

function readTokenFromFragment(): string | null {
  const raw = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
  const token = new URLSearchParams(raw).get('token');
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  return token && token.length >= 32 && token.length <= MAX_INVITATION_TOKEN_LENGTH ? token : null;
}

export function AcceptInvitePage(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [token, setToken] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  useEffect(() => {
    setToken(readTokenFromFragment());
    setIsChecking(false);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || password !== passwordConfirm) {
      setError(t('invitations.passwordMismatch'));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const data = await acceptBookInvitation(token, password, passwordConfirm);
      setAuth({
        sessionToken: data.sessionToken,
        sessionExpiresAt: new Date(data.expiresAt).getTime(),
        bookId: data.book.id,
        bookSlug: data.book.slug,
        bookTitle: data.book.title,
        email: data.email,
        capabilities: data.capabilities,
      });
      void navigate(data.role === 'creator' ? '/creator' : `/read/${data.book.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invitations.acceptError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background px-4 py-8 text-foreground sm:px-6">
      <main
        id="main-content"
        className="mx-auto flex min-h-[80dvh] w-full max-w-md flex-col justify-center"
      >
        <div className="mb-8 flex items-center gap-3">
          <AppLogo size={32} className="text-accent" />
          <span className="font-medium">{APP_NAME}</span>
        </div>

        {isChecking ? (
          <div
            className="flex justify-center py-12"
            role="status"
            aria-label={t('a11y.loading_page')}
          >
            <Spinner label={t('a11y.loading_page')} />
          </div>
        ) : !token ? (
          <section
            className="rounded-sm border border-border bg-surface p-6 shadow-page"
            aria-labelledby="invite-invalid-title"
          >
            <h1 id="invite-invalid-title" className="font-display text-2xl font-semibold">
              {t('invitations.invalidTitle')}
            </h1>
            <p className="mt-3 text-sm text-foreground-muted">
              {t('invitations.invalidDescription')}
            </p>
            <Button className="mt-6" onClick={() => void navigate(LOGIN_ROUTE)}>
              {t('invitations.backToLogin')}
            </Button>
          </section>
        ) : (
          <section
            className="rounded-sm border border-border bg-surface p-6 shadow-page"
            aria-labelledby="invite-title"
          >
            <h1 id="invite-title" className="font-display text-2xl font-semibold">
              {t('invitations.title')}
            </h1>
            <p className="mt-2 text-sm text-foreground-muted">{t('invitations.description')}</p>

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-sm border border-[var(--color-accent-error)]/30 bg-[var(--color-accent-error)]/10 p-3 text-sm text-[var(--color-accent-error)]"
              >
                {error}
              </p>
            )}

            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => void handleSubmit(event)}
              noValidate
            >
              <Input
                id="invite-password"
                label={t('invitations.passwordLabel')}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                showPasswordLabel={t('ui.showPassword')}
                hidePasswordLabel={t('ui.hidePassword')}
                required
              />
              <Input
                id="invite-password-confirm"
                label={t('invitations.passwordConfirmLabel')}
                type="password"
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                showPasswordLabel={t('ui.showPassword')}
                hidePasswordLabel={t('ui.hidePassword')}
                required
              />
              <Button
                type="submit"
                className="w-full"
                isLoading={isSubmitting}
                loadingLabel={t('invitations.accepting')}
                disabled={!password || !passwordConfirm}
              >
                {t('invitations.accept')}
              </Button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
