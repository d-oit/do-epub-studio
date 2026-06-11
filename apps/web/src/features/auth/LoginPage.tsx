import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';

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

  useEffect(() => {
    if (recoveryToken) {
      void handleVerifyRecovery(recoveryToken);
    }
  }, [recoveryToken]);

  const handleVerifyRecovery = async (token: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{
        sessionToken: string;
        book: { id: string; slug: string; title: string; authorName: string };
        capabilities: any;
      }>(
        '/api/access/verify-recovery',
        {
          method: 'POST',
          body: JSON.stringify({ token }),
        },
      );

      setAuth({
        sessionToken: data.sessionToken,
        bookId: data.book.id,
        bookSlug: data.book.slug,
        bookTitle: data.book.title,
        email: '', // Email is inside the JWT, but we can set it if needed
        capabilities: data.capabilities,
      });
      void navigate(`/read/${data.book.slug}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

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

  if (recoveryToken && isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
          <p className="text-gray-600 dark:text-gray-300">{t('login.verifyingToken')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center px-4">
      <div className="absolute top-4 right-4">
        <LocaleSwitcher />
      </div>

      <main id="main-content" className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-100 dark:border-gray-700">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isRecoveryMode ? t('login.recoveryTitle') : t('login.subtitle')}
          </h1>
          {bookSlug && (
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
              {t('login.bookSlugLabel')}: <span className="font-semibold">{bookSlug}</span>
            </p>
          )}
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {isRecoverySuccess ? (
          <div className="text-center">
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded text-sm text-green-700 dark:text-green-300">
              {t('login.recoverySuccess')}
            </div>
            <button
              onClick={() => {
                setIsRecoveryMode(false);
                setIsRecoverySuccess(false);
              }}
              className="text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
            >
              {t('login.backToLogin')}
            </button>
          </div>
        ) : isRecoveryMode ? (
          <form onSubmit={(e) => { void handleRecoveryRequest(e); }}>
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('login.recoveryInstructions')}
              </p>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  {t('login.emailLabel')}
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-500 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-gray-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? t('login.signingIn') : t('login.sendMagicLink')}
              </button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => setIsRecoveryMode(false)}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  {t('login.backToLogin')}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={(e) => { void handleSubmit(e); }}>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  {t('login.emailLabel')}
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-500 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {t('login.passwordLabel')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsRecoveryMode(true)}
                    className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
                  >
                    {t('login.forgotPassword')}
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-500 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-gray-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? t('login.signingIn') : t('login.submit')}
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 text-center space-y-4">
          <button
            onClick={() => void navigate('/admin/login')}
            className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          >
            {t('admin.login.backToReader')}
          </button>
        </div>
      </main>
    </div>
  );
}
