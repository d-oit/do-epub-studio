import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { useTranslation } from '../../hooks/useTranslation';
import { Spinner, Skeleton } from '@do-epub-studio/ui';
import type { LibraryBookResponse, PaginatedResponse } from '@do-epub-studio/shared';
import { BookCard } from './BookCard';

const PAGE_SIZE = 50;
const SKELETON_ROWS = [1, 2, 3, 4, 5, 6];

export function MyLibraryPage() {
  const { t } = useTranslation();
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const [books, setBooks] = useState<LibraryBookResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);
  // Bumped whenever the session-scoped initial load (re)starts or is torn
  // down; any in-flight append that captured an older generation is ignored.
  const generationRef = useRef(0);
  // Synchronous guard: React state updates are async, so two clicks in the
  // same render would both pass an `isLoadingMore` check.
  const appendInFlightRef = useRef(false);
  // Keeps the error fallback out of the effect dependency list so a locale
  // change cannot reset the shelf — only a session change reloads it.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const fetchBooks = useCallback(async (offset: number) => {
    const url = `/api/books?limit=${PAGE_SIZE}&offset=${offset}`;
    const data = await apiRequest<PaginatedResponse<LibraryBookResponse>>(url, {
      token: sessionToken ?? undefined,
    });
    return data;
  }, [sessionToken]);

  useEffect(() => {
    const generation = ++generationRef.current;
    appendInFlightRef.current = false;
    let cancelled = false;

    // Reset before fetching: a replacement session must never render the
    // previous account's shelf, appended pages or append errors.
    setIsLoading(true);
    setIsLoadingMore(false);
    setError(null);
    setLoadMoreError(null);
    setBooks([]);
    setHasMore(false);
    offsetRef.current = 0;

    async function load() {
      try {
        const data = await fetchBooks(0);
        if (cancelled || generation !== generationRef.current) return;
        setBooks(data.items);
        setHasMore(data.hasMore);
        offsetRef.current = data.items.length;
      } catch (err) {
        if (cancelled || generation !== generationRef.current) return;
        setError(err instanceof Error ? err.message : tRef.current('common.error.generic'));
      } finally {
        if (!cancelled && generation === generationRef.current) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
      generationRef.current += 1;
    };
  }, [fetchBooks]);

  const loadMore = useCallback(async () => {
    if (appendInFlightRef.current || !hasMore) return;
    appendInFlightRef.current = true;
    const generation = generationRef.current;
    setIsLoadingMore(true);
    setLoadMoreError(null);
    try {
      const data = await fetchBooks(offsetRef.current);
      // Stale generation: the session was replaced, leave its state alone.
      if (generation !== generationRef.current) return;
      setBooks((prev) => [...prev, ...data.items]);
      setHasMore(data.hasMore);
      offsetRef.current += data.items.length;
    } catch (err) {
      if (generation !== generationRef.current) return;
      setLoadMoreError(err instanceof Error ? err.message : tRef.current('common.error.generic'));
    } finally {
      if (generation === generationRef.current) {
        setIsLoadingMore(false);
        appendInFlightRef.current = false;
      }
    }
  }, [fetchBooks, hasMore]);

  const inProgress = books.filter((b) => b.progressPercent > 0 && b.progressPercent < 100);
  const notStarted = books.filter((b) => b.progressPercent === 0);
  const completed = books.filter((b) => b.progressPercent >= 100);

  // GOAP-268 UX-01: nested under AppShell, which owns the single
  // `main#main-content` landmark, the product identity header and the
  // horizontal page padding.
  return (
    <div className="py-6 text-foreground md:py-10">
      {/* A container cannot query itself: `shelf` is the shared ancestor and
          the grids below are its descendants. */}
      <div className="mx-auto max-w-7xl @container/shelf">
        <header className="mb-8 flex flex-col gap-6 border-b border-[var(--color-rule)] pb-6">
          <h1 className="text-balance-tight font-display text-3xl leading-tight md:text-4xl">{t('library.title')}</h1>
          <p className="mt-2 max-w-2xl text-pretty text-foreground-muted">{t('library.subtitle')}</p>
        </header>

        {isLoading ? (
          <div
            role="status"
            aria-busy="true"
            aria-label={t('a11y.loading_page')}
            className="grid grid-cols-1 gap-4 @3xl/shelf:grid-cols-2"
          >
            {SKELETON_ROWS.map((i) => (
              <div key={i} className="flex gap-4 rounded-sm border border-border bg-surface p-4 shadow-page">
                <Skeleton className="aspect-[2/3] w-16 shrink-0 sm:w-24" />
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <p role="alert" className="text-center text-[var(--color-accent-error)]">{error}</p>
        ) : books.length === 0 ? (
          <p className="text-center text-foreground-muted">{t('library.empty')}</p>
        ) : (
          <div className="space-y-12">
            {inProgress.length > 0 && (
              <section aria-labelledby="heading-in-progress">
                <h2 id="heading-in-progress" className="mb-6 font-[family-name:var(--font-display)] text-xl font-bold text-foreground">{t('library.inProgress')}</h2>
                <ul className="grid list-none grid-cols-1 gap-4 p-0 @3xl/shelf:grid-cols-2">
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
                <h2 id="heading-not-started" className="mb-6 font-[family-name:var(--font-display)] text-xl font-bold text-foreground">{t('library.notStarted')}</h2>
                <ul className="grid list-none grid-cols-1 gap-4 p-0 @3xl/shelf:grid-cols-2">
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
                <h2 id="heading-completed" className="mb-6 font-[family-name:var(--font-display)] text-xl font-bold text-foreground">{t('library.completed')}</h2>
                <ul className="grid list-none grid-cols-1 gap-4 p-0 @3xl/shelf:grid-cols-2">
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
          <div className="mt-8 flex flex-col items-center gap-3" aria-busy={isLoadingMore}>
            {loadMoreError && (
              <p role="alert" className="text-center text-sm text-[var(--color-accent-error)]">
                {loadMoreError}
              </p>
            )}
            <button
              type="button"
              onClick={() => { void loadMore(); }}
              disabled={isLoadingMore}
              className="inline-flex items-center gap-2 rounded-[var(--radius-paper)] border border-[var(--color-rule)] bg-[var(--color-paper)] px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--color-paper)_90%,var(--color-foreground)_10%)] disabled:opacity-50"
            >
              {isLoadingMore && (
                <span aria-hidden="true">
                  <Spinner size="sm" label="" />
                </span>
              )}
              {loadMoreError ? t('common.retry') : t('library.loadMore')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
