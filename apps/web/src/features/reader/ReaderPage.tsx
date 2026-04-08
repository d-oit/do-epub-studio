import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore, useReaderStore, usePreferencesStore } from '../../stores';

export function ReaderPage() {
  const { bookSlug } = useParams<{ bookSlug: string }>();
  const navigate = useNavigate();
  const { sessionToken, bookTitle, capabilities: _capabilities, logout } = useAuthStore();
  const { progress: _progress, setProgress: _setProgress, setError, error } = useReaderStore();
  const { reader: _reader } = usePreferencesStore();
  const { t } = useTranslation();

  const viewerRef = useRef<HTMLDivElement>(null);
  const [epubUrl, setEpubUrl] = useState<string | null>(null);
  const [toc] = useState<Array<{ label: string; href: string }>>([]);
  const [showToc, setShowToc] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  void _capabilities;
  void _progress;
  void _setProgress;
  void _reader;

  useEffect(() => {
    if (!sessionToken || !bookSlug) {
      navigate('/login');
      return;
    }

    const controller = new AbortController();

    const fetchBookUrl = async () => {
      try {
        const data = await apiRequest<{ url: string }>(`/api/books/${bookSlug}/file-url`, {
          method: 'POST',
          token: sessionToken,
          body: JSON.stringify({}),
          signal: controller.signal,
        });
        setEpubUrl(data.url);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        setError((err as Error).message || t('reader.notAvailable'));
      } finally {
        setIsLoading(false);
      }
    };

    void fetchBookUrl();
    return () => controller.abort();
  }, [sessionToken, bookSlug, navigate, setError, t]);

  const handleLogout = async () => {
    try {
      await apiRequest('/api/access/logout', {
        method: 'POST',
        token: sessionToken ?? undefined,
      });
    } catch (error) {
      console.error('Logout failed', error);
    } finally {
      logout();
      navigate('/login');
    }
  };

  const themeClass = {
    light: 'bg-white text-gray-900',
    dark: 'bg-gray-900 text-gray-100',
    sepia: 'bg-amber-50 text-gray-800',
    system: '',
  }[_reader.theme];

  return (
    <div className={`min-h-screen ${themeClass}`}>
      <header className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-50">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowToc(!showToc)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              aria-label={t('reader.tableOfContents')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <h1 className="font-medium truncate max-w-xs">{bookTitle || bookSlug}</h1>
          </div>

          <div className="flex items-center space-x-2">
            <LocaleSwitcher />
            <button
              onClick={() => {
                void handleLogout();
              }}
              className="px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              {t('reader.signOut')}
            </button>
          </div>
        </div>
      </header>

      <main className="pt-14 pb-20">
        {error && (
          <div className="max-w-3xl mx-auto px-4 mt-4">
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : epubUrl ? (
          <div ref={viewerRef} className="max-w-3xl mx-auto px-4 py-8">
            <div className="aspect-[3/4] bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
              <p className="text-gray-500 dark:text-gray-400">
                {t('reader.loading')} ({epubUrl ? 'URL ready' : 'No URL'})
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-96">
            <p className="text-gray-500 dark:text-gray-400">{t('reader.notAvailable')}</p>
          </div>
        )}
      </main>

      {showToc && (
        <aside className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-40 overflow-y-auto">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h2 className="font-semibold">{t('reader.tableOfContents')}</h2>
            <button
              onClick={() => setShowToc(false)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <nav className="p-2">
            {toc.length > 0 ? (
              toc.map((item, index) => (
                <button
                  key={index}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  {item.label}
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-gray-500">{t('reader.noChapters')}</p>
            )}
          </nav>
        </aside>
      )}
    </div>
  );
}
