import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { useTranslation } from '../../hooks/useTranslation';
import { AppLogo } from '../../components/ui';
import { Spinner, Skeleton } from '@do-epub-studio/ui';
import { APP_NAME, APP_VERSION_LABEL } from '../../config/app-identity';
import type { LibraryBookResponse, PaginatedResponse } from '@do-epub-studio/shared';
import { BookCard } from './BookCard';

const PAGE_SIZE = 50;

export function MyLibraryPage() {
  const { t } = useTranslation();
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const [books, setBooks] = useState<LibraryBookResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  const fetchBooks = useCallback(async (offset: number) => {
    const url = `/api/books?limit=${PAGE_SIZE}&offset=${offset}`;
    const data = await apiRequest<PaginatedResponse<LibraryBookResponse>>(url, {
      token: sessionToken ?? undefined,
    });
    return data;
  }, [sessionToken]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        offsetRef.current = 0;
        const data = await fetchBooks(0);
        if (!cancelled) {
          setBooks(data.items);
          setHasMore(data.hasMore);
          offsetRef.current = data.items.length;
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load library');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [fetchBooks]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const data = await fetchBooks(offsetRef.current);
      setBooks((prev) => [...prev, ...data.items]);
      setHasMore(data.hasMore);
      offsetRef.current += data.items.length;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more');
    } finally {
      setIsLoadingMore(false);
    }
  }, [fetchBooks, isLoadingMore, hasMore]);

  const inProgress = books.filter((b) => b.progressPercent > 0 && b.progressPercent < 100);
  const notStarted = books.filter((b) => b.progressPercent === 0);
  const completed = books.filter((b) => b.progressPercent >= 100);

  return (
    <main
      id="main-content"
      className="min-h-dvh bg-[var(--color-background)] px-4 py-6 text-[var(--color-foreground)] sm:px-6 md:py-10 lg:px-8 2xl:px-12"
    >
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-6 border-b border-[var(--color-rule)] pb-6">
          <div className="mb-4 flex items-center gap-3">
            <AppLogo size={32} className="text-[var(--color-accent)]" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--color-foreground)]">{APP_NAME}</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">{APP_VERSION_LABEL}</p>
            </div>
          </div>
          <h1 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">{t('library.title')}</h1>
          <p className="mt-2 max-w-2xl text-[var(--color-muted-foreground)]">{t('library.subtitle')}</p>
        </header>

        {isLoading ? (
          <div className="@container/shelf grid grid-cols-2 gap-6 @md/shelf:grid-cols-3 @2xl/shelf:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex flex-col gap-3">
                <Skeleton className="aspect-[2/3] w-full rounded-[var(--radius-paper)]" />
                <Skeleton className="h-6 w-3/4 rounded" />
                <Skeleton className="h-4 w-1/2 rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p role="alert" className="text-center text-[var(--color-accent-error)]">{error}</p>
        ) : books.length === 0 ? (
          <p className="text-center text-[var(--color-muted-foreground)]">{t('library.empty')}</p>
        ) : (
          <div className="space-y-12">
            {inProgress.length > 0 && (
              <section aria-labelledby="heading-in-progress">
                <h2 id="heading-in-progress" className="mb-6 font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-foreground)]">{t('library.inProgress')}</h2>
                <ul className="@container/shelf grid grid-cols-2 gap-6 @md/shelf:grid-cols-3 @2xl/shelf:grid-cols-5 list-none p-0">
                  {inProgress.map((book) => (
                    <li key={book.id}>
                      <BookCard book={book} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {notStarted.length > 0 && (
              <section aria-labelledby="heading-not-started">
                <h2 id="heading-not-started" className="mb-6 font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-foreground)]">{t('library.notStarted')}</h2>
                <ul className="@container/shelf grid grid-cols-2 gap-6 @md/shelf:grid-cols-3 @2xl/shelf:grid-cols-5 list-none p-0">
                  {notStarted.map((book) => (
                    <li key={book.id}>
                      <BookCard book={book} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {completed.length > 0 && (
              <section aria-labelledby="heading-completed">
                <h2 id="heading-completed" className="mb-6 font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-foreground)]">{t('library.completed')}</h2>
                <ul className="@container/shelf grid grid-cols-2 gap-6 @md/shelf:grid-cols-3 @2xl/shelf:grid-cols-5 list-none p-0">
                  {completed.map((book) => (
                    <li key={book.id}>
                      <BookCard book={book} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {hasMore && !isLoading && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => { void loadMore(); }}
              disabled={isLoadingMore}
              className="rounded-[var(--radius-paper)] border border-[var(--color-rule)] bg-[var(--color-paper)] px-6 py-2.5 text-sm font-medium text-[var(--color-foreground)] transition-colors hover:bg-[color-mix(in_oklch,var(--color-paper)_90%,var(--color-foreground)_10%)] disabled:opacity-50"
            >
              {isLoadingMore ? <Spinner /> : t('library.loadMore')}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
