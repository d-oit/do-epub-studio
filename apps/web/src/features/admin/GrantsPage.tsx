import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { GrantResponse } from '@do-epub-studio/shared';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';

interface LocationState {
  bookTitle?: string;
}

export function AdminGrantResponsesPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState | null;
  const [grants, setGrantResponses] = useState<GrantResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGrantResponses = useCallback(async () => {
    if (!bookId) return;
    setIsLoading(true);
    try {
      const data = await apiRequest<GrantResponse[]>(`/api/admin/books/${bookId}/grants`);
      setGrantResponses(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    void fetchGrantResponses();
  }, [bookId, fetchGrantResponses]);

  const handleRevoke = async (grantId: string) => {
    if (!confirm(t('admin.grants.confirmRevoke'))) return;
    try {
      await apiRequest(`/api/admin/grants/${grantId}`, { method: 'DELETE' });
      void fetchGrantResponses();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('admin.grants.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {locationState?.bookTitle ?? `${t('admin.books.title')} ID: ${bookId}`}
          </p>
          <button
            onClick={() => void navigate('/admin/books')}
            className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 mt-1"
          >
            &larr; {t('admin.grants.backToBooks')}
          </button>
        </div>
        <LocaleSwitcher />
      </header>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('admin.grants.email')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('admin.grants.mode')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('admin.grants.expires')}
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {grants.map((grant) => (
                <tr key={grant.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {grant.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {grant.mode}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {grant.expiresAt ? new Date(grant.expiresAt).toLocaleDateString() : t('admin.grants.never')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => void handleRevoke(grant.id)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      {t('admin.grants.revoke')}
                    </button>
                  </td>
                </tr>
              ))}
              {grants.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    {t('admin.grants.noGrantResponses')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
