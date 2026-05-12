import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { BookResponse } from '@do-epub-studio/shared';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';

export function AdminBookResponsesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [books, setBookResponses] = useState<BookResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookResponses = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest<BookResponse[]>('/api/admin/books');
      setBookResponses(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchBookResponses();
  }, []);

  const handleViewGrants = (bookId: string) => {
    void navigate(`/admin/books/${bookId}/grants`);
  };

  const handleBackToReader = () => {
    void void navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('admin.books.title')}
          </h1>
          <button
            onClick={handleBackToReader}
            className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 mt-1"
          >
            &larr; {t('admin.books.backToReader')}
          </button>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => void void navigate('/admin/audit-logs')}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {t('admin.books.viewAuditLogs')}
          </button>
          <LocaleSwitcher />
        </div>
      </header>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full py-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          books.map((book) => (
            <div
              key={book.id}
              className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {book.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                {book.description || t('admin.books.noDescription')}
              </p>
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300 uppercase">
                  {book.visibility}
                </span>
                <button
                  onClick={() => handleViewGrants(book.id)}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
                >
                  {t('admin.books.manageAccess')} &rarr;
                </button>
              </div>
            </div>
          ))
        )}
        {!isLoading && books.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400">
            {t('admin.books.noBookResponses')}
          </div>
        )}
      </div>
    </div>
  );
}
