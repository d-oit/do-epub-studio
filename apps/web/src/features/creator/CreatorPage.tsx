import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { Spinner } from '@do-epub-studio/ui';
import { useCreatorBooks } from './hooks/useCreatorBooks';
import { useCreatorStore } from '../../stores/creator-feedback';

export function CreatorPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { books, isLoading, error, refresh } = useCreatorBooks();
  const setBooks = useCreatorStore((s) => s.setBooks);

  useEffect(() => {
    setBooks(books);
  }, [books, setBooks]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl font-semibold">{t('creator.title')}</h1>

      {isLoading && books.length === 0 && (
        <div className="mt-8 flex justify-center" aria-label={t('creator.title')}>
          <Spinner />
        </div>
      )}

      {error && books.length === 0 && (
        <div className="mt-8 rounded-lg border border-border p-4">
          <p role="alert" className="text-sm text-foreground-muted">{t('creator.loadError')}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-2 text-sm font-medium text-accent underline underline-offset-2"
          >
            {t('creator.retry')}
          </button>
        </div>
      )}

      {!isLoading && !error && books.length === 0 && (
        <p className="mt-8 rounded-lg border border-border bg-background-secondary p-4 text-sm text-foreground-muted">
          {t('creator.emptyUnassigned')}
        </p>
      )}

      {books.length > 0 && (
        <>
          <h2 className="mt-6 text-sm font-medium uppercase tracking-wide text-foreground-muted">
            {t('creator.assignedBooks')}
          </h2>
          <ul className="mt-2 space-y-2">
            {books.map((book) => (
              <li key={book.id}>
                <Link
                  to={`/creator/books/${book.id}/feedback`}
                  className="block rounded-lg border border-border p-4 transition-colors hover:border-accent hover:bg-background-secondary"
                >
                  <span className="font-medium">{book.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
