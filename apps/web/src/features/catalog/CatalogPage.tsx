import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { useTranslation } from '../../hooks/useTranslation';
import { AppLogo, Pagination, SearchInput } from '../../components/ui';
import { APP_NAME, APP_VERSION_LABEL } from '../../config/app-identity';
import type { PaginatedResponse } from '@do-epub-studio/shared';

interface CatalogBook {
  id: string;
  slug: string;
  title: string;
  authorName: string | null;
  description: string | null;
  language: string;
  coverImageUrl: string | null;
  publishedAt: string | null;
}

type CatalogPayload = PaginatedResponse<CatalogBook>;

const PAGE_SIZE = 24;
const DEFAULT_PAGE = 1;

export function CatalogPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<CatalogPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const q = searchParams.get('q') ?? '';
  const author = searchParams.get('author') ?? '';
  const language = searchParams.get('language') ?? '';
  const page = Math.max(DEFAULT_PAGE, parseInt(searchParams.get('page') ?? '1', 10) || DEFAULT_PAGE);
  const offset = (page - 1) * PAGE_SIZE;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (author) params.set('author', author);
        if (language) params.set('language', language);
        params.set('limit', String(PAGE_SIZE));
        params.set('offset', String(offset));
        const url = `/api/catalog${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await apiRequest<CatalogPayload>(url);
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load catalog');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [q, author, language, offset]);

  function setParam(key: 'q' | 'author' | 'language' | 'page', value: string | null) {
    const next = new URLSearchParams(searchParams);
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setSearchParams(next, { replace: true });
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const books = data?.items ?? [];

  return (
    <main
      id="main-content"
      className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-6 md:py-10 lg:px-8 2xl:px-12"
    >
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-6 border-b border-border pb-6 md:mb-10 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="mb-4 flex items-center gap-3">
              <AppLogo size={32} className="text-accent" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{APP_NAME}</p>
                <p className="text-xs text-foreground-muted">{APP_VERSION_LABEL}</p>
              </div>
            </div>
            <h1 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">{t('catalog.title')}</h1>
            <p className="mt-2 max-w-2xl text-foreground-muted">{t('catalog.subtitle')}</p>
          </div>
        </header>

        <div className="@container mb-6">
          <div className="grid gap-3 @md:grid-cols-3">
            <SearchInput
              ariaLabel={t('catalog.search.placeholder')}
              placeholder={t('catalog.search.placeholder')}
              value={q}
              onChange={(value: string) => setParam('q', value)}
              debounceMs={300}
              className="w-full"
            />
            <SearchInput
              ariaLabel={t('catalog.filter.author')}
              placeholder={t('catalog.filter.author')}
              value={author}
              onChange={(value: string) => setParam('author', value)}
              debounceMs={300}
              className="w-full"
            />
            <SearchInput
              ariaLabel={t('catalog.filter.language')}
              placeholder={t('catalog.filter.language')}
              value={language}
              onChange={(value: string) => setParam('language', value)}
              debounceMs={300}
              className="w-full"
            />
          </div>
        </div>

        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-busy="true">
            {['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5', 'sk-6'].map((id) => (
              <div key={id} className="h-72 rounded-lg bg-background-secondary animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="text-center text-accent-error">{error}</p>
        )}

        {!isLoading && !error && books.length === 0 && (
          <p className="text-center text-foreground-muted">{t('catalog.empty')}</p>
        )}

        {!isLoading && books.length > 0 && (
          <>
            <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {books.map((book) => (
                <li key={book.id}>
                  <Link
                    to={`/login?book=${book.slug}`}
                    className="group block h-full rounded-lg border border-border bg-background-secondary p-4 shadow-sm transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {book.coverImageUrl ? (
                      <picture>
                        <source srcSet={book.coverImageUrl} />
                        <img
                          src={book.coverImageUrl}
                          alt={t('catalog.coverAlt').replace('{title}', book.title)}
                          width={320}
                          height={426}
                          className="mb-4 aspect-[3/4] w-full rounded-md object-cover"
                        />
                      </picture>
                    ) : (
                      <div className="mb-4 flex aspect-[3/4] w-full items-center justify-center rounded-md bg-background-tertiary text-foreground-muted">
                        <AppLogo size={40} className="text-accent" />
                      </div>
                    )}
                    <h2 className="line-clamp-2 text-lg font-semibold leading-snug group-hover:text-accent">{book.title}</h2>
                    {book.authorName && (
                      <p className="text-sm text-foreground-muted mt-1">{book.authorName}</p>
                    )}
                    {book.description && (
                      <p className="text-sm text-foreground-muted mt-2 line-clamp-3">
                        {book.description}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
            {data && data.total > 0 && (
              <div className="mt-8 flex flex-col items-center gap-3">
                <p className="text-sm text-foreground-muted">
                  {t('catalog.pagination.info')
                    .replace('{from}', String(offset + 1))
                    .replace('{to}', String(Math.min(offset + books.length, data.total)))
                    .replace('{total}', String(data.total))}
                </p>
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={(p: number) => setParam('page', String(p))}
                />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
