import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { Button } from '../../components/ui';
import { isDemoLoginEnabled, DEMO_READER_EMAIL } from '../../config/demo-config';

export interface SessionCapabilities {
  canRead: boolean;
  canComment: boolean;
  canHighlight: boolean;
  canBookmark: boolean;
  canDownloadOffline: boolean;
  canExportNotes: boolean;
  canManageAccess: boolean;
}

export interface SessionResponse {
  sessionToken: string;
  expiresAt?: string;
  book: { id: string; slug: string; title: string; authorName: string };
  capabilities: SessionCapabilities | null;
}

export function toAuthStorePayload(data: SessionResponse, email: string) {
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

export function useDemoLogin() {
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
      setAuth(toAuthStorePayload(data, DEMO_READER_EMAIL));
      void navigate(`/read/${data.book.slug}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, login };
}

export function DemoLoginBlock({
  loading,
  error,
  onLogin,
  onFillCredentials,
}: {
  loading: boolean;
  error: string | null;
  onLogin: () => void;
  onFillCredentials: () => void;
}) {
  const { t } = useTranslation();
  if (!isDemoLoginEnabled()) return null;
  return (
    <div className="mt-5">
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-foreground-muted">{t('login.demoOr')}</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="mt-4 p-3 bg-accent-error/10 border border-accent-error/30 rounded-lg text-sm text-accent-error"
        >
          {error}
        </div>
      )}

      <Button
        type="button"
        variant="primary"
        className="mt-4 w-full"
        isLoading={loading}
        loadingLabel={t('login.demoSigningIn')}
        onClick={onLogin}
      >
        {t('login.demoTry')}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-1 w-full"
        onClick={onFillCredentials}
      >
        {t('login.demoFillCredentials')}
      </Button>
    </div>
  );
}
