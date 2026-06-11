import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { Button, Input } from '../../components/ui';
import { ThemeToggle } from '../../components/ThemeToggle';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bookSlug = searchParams.get('book') || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiRequest<{
        sessionToken: string;
        book: { id: string; slug: string; title: string; authorName: string };
        capabilities: {
          canRead: boolean;
          canComment: boolean;
          canHighlight: boolean;
          canBookmark: boolean;
          canDownloadOffline: boolean;
          canExportNotes: boolean;
          canManageAccess: boolean;
        } | null;
      }>(
        '/api/access/request',
        {
          method: 'POST',
          body: JSON.stringify({ email, password, bookSlug }),
        },
      );

      setAuth({
        sessionToken: data.sessionToken,
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

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <ThemeToggle />
        <LocaleSwitcher />
      </div>

      <main id="main-content" className="max-w-md w-full bg-background-secondary rounded-xl shadow-lg p-8 border border-border">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">
            {t('login.subtitle')}
          </h1>
          {bookSlug && (
            <p className="text-foreground-muted mt-2 text-sm">
              {t('login.bookSlugLabel')}: <span className="font-semibold">{bookSlug}</span>
            </p>
          )}
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
              label={t('login.emailLabel')}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Input
              id="password"
              label={t('login.passwordLabel')}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              helperText={t('login.passwordHelper')}
            />

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

        <div className="mt-8 pt-6 border-t border-border text-center space-y-3">
          <p className="text-sm text-foreground-muted">
            {t('login.adminDescription')}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void navigate('/admin/login')}
            className="underline decoration-primary-500/30 hover:decoration-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            {t('login.adminLink')}
          </Button>
        </div>
      </main>
    </div>
  );
}
