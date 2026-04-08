import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';

interface LoginSuccess {
  sessionToken: string;
  book: {
    id: string;
    slug: string;
    title: string;
    authorName: string | null;
  };
  capabilities: {
    canRead: boolean;
    canComment: boolean;
    canHighlight: boolean;
    canBookmark: boolean;
    canDownloadOffline: boolean;
    canExportNotes: boolean;
    canManageAccess: boolean;
  };
}

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const { t } = useTranslation();
  const [bookSlug, setBookSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const data = await apiRequest<LoginSuccess>('/api/access/request', {
        method: 'POST',
        body: JSON.stringify({
          bookSlug: bookSlug.trim(),
          email: email.trim().toLowerCase(),
          password: password || undefined,
        }),
      });

      setAuth({
        sessionToken: data.sessionToken,
        bookId: data.book.id,
        bookSlug: data.book.slug,
        bookTitle: data.book.title,
        email: email.trim().toLowerCase(),
        capabilities: data.capabilities,
      });

      navigate(`/read/${data.book.slug}`);
    } catch (err) {
      setError((err as Error).message || t('login.error.network'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full">
        <div className="flex justify-end mb-4">
          <LocaleSwitcher />
        </div>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('app.title')}</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">{t('login.subtitle')}</p>
        </div>

        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-4"
        >
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="bookSlug"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {t('login.bookSlugLabel')}
            </label>
            <input
              id="bookSlug"
              type="text"
              value={bookSlug}
              onChange={(e) => setBookSlug(e.target.value)}
              placeholder={t('login.bookSlugPlaceholder')}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('login.emailPlaceholder')}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {t('login.passwordLabel')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('login.passwordPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md shadow focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? t('login.signingIn') : t('login.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
