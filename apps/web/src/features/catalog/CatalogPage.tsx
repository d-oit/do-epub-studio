import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { useTranslation } from '../../hooks/useTranslation';
import { AppLogo } from '../../components/ui';
import { APP_NAME, APP_VERSION_LABEL } from '../../config/app-identity';

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

export function CatalogPage() {
  const { t } = useTranslation();
  const [books, setBooks] = useState<CatalogBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await apiRequest<CatalogBook[]>('/api/catalog');
        if (!cancelled) setBooks(res);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load catalog');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

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
        )}
      </div>
    </main>
  );
}
