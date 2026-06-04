import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';

export function AdminLoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setAdminAuth = useAuthStore((state) => state.setAdminAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiRequest<{ sessionToken: string; email: string }>(
        '/api/admin/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        },
      );

      setAdminAuth({ sessionToken: data.sessionToken, email: data.email });
      void navigate('/admin/books');
    } catch (err) {
      setError((err as Error).message || t('admin.login.invalidCredentials'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center px-4">
      <div className="absolute top-4 right-4">
        <LocaleSwitcher />
      </div>

      <main id="main-content" className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-100 dark:border-gray-700">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('admin.login.title')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
            d.o. EPUB Studio Management
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1"
              >
                {t('admin.login.email')}
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-500 dark:border-gray-500 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1"
              >
                {t('admin.login.password')}
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-500 dark:border-gray-500 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-gray-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? t('admin.login.signingIn') : t('admin.login.signIn')}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => { void navigate('/login'); }}
            className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          >
            {t('admin.login.backToReader')}
          </button>
        </div>
      </main>
    </div>
  );
}
