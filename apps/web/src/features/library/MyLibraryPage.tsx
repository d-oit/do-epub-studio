import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { useTranslation } from '../../hooks/useTranslation';
import { AppLogo, ProgressBar } from '../../components/ui';
import { Spinner } from '@do-epub-studio/ui';
import { APP_NAME, APP_VERSION_LABEL } from '../../config/app-identity';
import type { LibraryBookResponse } from '@do-epub-studio/shared';

export function MyLibraryPage() {
  const { t } = useTranslation();
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const [books, setBooks] = useState<LibraryBookResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiRequest<LibraryBookResponse[]>('/api/books', { token: sessionToken ?? undefined });
        if (!cancelled) setBooks(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load library');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [sessionToken]);

  const inProgress = books.filter((b) => b.progressPercent > 0 && b.progressPercent < 100);
  const notStarted = books.filter((b) => b.progressPercent === 0);
  const completed = books.filter((b) => b.progressPercent >= 100);

  return (
    <main
      id="main-content"
      className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-6 md:py-10 lg:px-8 2xl:px-12"
    >
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-6 border-b border-border pb-6">
          <div className="mb-4 flex items-center gap-3">
            <AppLogo size={32} className="text-accent" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{APP_NAME}</p>
              <p className="text-xs text-foreground-muted">{APP_VERSION_LABEL}</p>
            </div>
          </div>
          <h1 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">{t('library.title')}</h1>
          <p className="mt-2 max-w-2xl text-foreground-muted">{t('library.subtitle')}</p>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : error ? (
          <p role="alert" className="text-center text-accent-error">{error}</p>
        ) : books.length === 0 ? (
          <p className="text-center text-foreground-muted">{t('library.empty')}</p>
        ) : (
          <div className="space-y-10">
            {inProgress.length > 0 && (
              <section>
                <h2 className="mb-4 text-lg font-semibold text-foreground">{t('library.inProgress')}</h2>
                <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
                  {inProgress.map((book) => (
                    <li key={book.id}>
                      <Link
                        to={`/read/${book.slug}`}
                        className="group block h-full rounded-lg border border-border bg-background-secondary p-5 shadow-sm transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        <h3 className="mb-1 line-clamp-2 text-lg font-semibold leading-snug group-hover:text-accent">{book.title}</h3>
                        {book.authorName && <p className="mb-3 text-sm text-foreground-muted">{book.authorName}</p>}
                        <ProgressBar value={book.progressPercent} showValue className="mb-2" label={t('library.progress')} />
                        {book.progressUpdatedAt && (
                          <p className="text-xs text-foreground-muted">
                            {t('library.lastRead')} {new Date(book.progressUpdatedAt).toLocaleDateString()}
                          </p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {notStarted.length > 0 && (
              <section>
                <h2 className="mb-4 text-lg font-semibold text-foreground">{t('library.notStarted')}</h2>
                <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
                  {notStarted.map((book) => (
                    <li key={book.id}>
                      <Link
                        to={`/read/${book.slug}`}
                        className="group block h-full rounded-lg border border-border bg-background-secondary p-5 shadow-sm transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        <h3 className="mb-1 line-clamp-2 text-lg font-semibold leading-snug group-hover:text-accent">{book.title}</h3>
                        {book.authorName && <p className="text-sm text-foreground-muted">{book.authorName}</p>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {completed.length > 0 && (
              <section>
                <h2 className="mb-4 text-lg font-semibold text-foreground">{t('library.completed')}</h2>
                <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
                  {completed.map((book) => (
                    <li key={book.id}>
                      <Link
                        to={`/read/${book.slug}`}
                        className="group block h-full rounded-lg border border-border bg-background-secondary p-5 shadow-sm transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        <h3 className="mb-1 line-clamp-2 text-lg font-semibold leading-snug group-hover:text-accent">{book.title}</h3>
                        {book.authorName && <p className="text-sm text-foreground-muted">{book.authorName}</p>}
                        <span className="mt-2 inline-block text-xs font-medium text-accent">{t('library.finished')}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
