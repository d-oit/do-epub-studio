import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../lib/api';

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
      className="min-h-screen bg-background text-foreground p-6 md:p-12"
    >
      <div className="max-w-5xl mx-auto">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Book Catalog</h1>
          <p className="mt-2 text-foreground-muted">Browse publicly available books</p>
        </header>

        {isLoading && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5', 'sk-6'].map((id) => (
              <div key={id} className="h-64 rounded-xl bg-background-secondary animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="text-center text-accent-error">{error}</p>
        )}

        {!isLoading && !error && books.length === 0 && (
          <p className="text-center text-foreground-muted">No public books available yet.</p>
        )}

        {!isLoading && books.length > 0 && (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 list-none p-0">
            {books.map((book) => (
              <li key={book.id}>
                <Link
                  to={`/login?book=${book.slug}`}
                  className="block rounded-xl border border-white/10 bg-surface/40 backdrop-blur-sm p-5 shadow-glass hover:shadow-glass-lg transition-shadow focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {book.coverImageUrl && (
                    <picture>
                      <source srcSet={book.coverImageUrl} />
                      {/* eslint-disable-next-line jsx-a11y/img-redundant-alt -- cover thumbnail */}
                      <img
                        src={book.coverImageUrl}
                        alt={`Cover of ${book.title}`}
                        width={320}
                        height={160}
                        className="w-full h-40 object-cover rounded-lg mb-4"
                      />
                    </picture>
                  )}
                  <h2 className="text-lg font-semibold line-clamp-2">{book.title}</h2>
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
