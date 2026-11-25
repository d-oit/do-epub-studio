import { Link } from 'react-router-dom';
import { ProgressBar } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { formatDate } from '../../lib/i18n-format';
import type { LibraryBookResponse } from '@do-epub-studio/shared';
import { useOfflineBook } from './hooks/useOfflineBook';

function OfflineControl({ bookId }: { bookId: string }) {
  const { t } = useTranslation();
  const { status, busy, download, remove } = useOfflineBook(bookId);

  if (status.kind === 'ready') {
    return (
      <span className="mt-3 flex items-center gap-2 text-xs text-semantic-success">
        <svg
          className="size-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        {t('library.offline.ready')}
        <button
          type="button"
          onClick={() => void remove()}
          disabled={busy}
          className="text-foreground-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
        >
          {t('library.offline.remove')}
        </button>
      </span>
    );
  }

  if (status.kind === 'downloading') {
    return (
      <span className="mt-3 flex items-center gap-2 text-xs text-foreground-muted">
        <span className="size-3 animate-spin rounded-full border border-current border-t-transparent" />
        {t('library.offline.downloading')}
        {status.percent !== null ? ` ${status.percent}%` : ''}
      </span>
    );
  }

  const label =
    status.kind === 'failed' ? t('library.offline.retry') : t('library.offline.download');
  return (
    <button
      type="button"
      onClick={() => void download()}
      disabled={busy}
      className="mt-3 rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-background-tertiary disabled:opacity-50"
    >
      {label}
    </button>
  );
}

export function BookCard({ book }: { book: LibraryBookResponse }) {
  const { t } = useTranslation();
  const { slug, title, authorName, coverImageUrl, progressPercent, progressUpdatedAt } = book;
  const reading = progressPercent > 0 && progressPercent < 100;
  const finished = progressPercent >= 100;

  return (
    <article className="group relative flex gap-4 rounded-sm border border-border bg-surface p-4 shadow-page transition-colors hover:border-accent/40">
      <Link
        to={`/read/${slug}`}
        aria-label={title}
        className="relative block w-16 shrink-0 overflow-hidden rounded-[3px] bg-muted sm:w-24"
        style={{ aspectRatio: '2 / 3' }}
      >
        {coverImageUrl ? (
          <img
            src={coverImageUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span
            className="flex size-full items-center justify-center text-muted-foreground"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-6"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </span>
        )}
        {progressPercent > 0 ? (
          <span className="absolute inset-x-0 bottom-0 h-1 bg-accent/25">
            <span className="block h-full bg-accent" style={{ width: `${progressPercent}%` }} />
          </span>
        ) : null}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="min-w-0 text-pretty break-words font-display text-base font-semibold leading-snug tracking-tight">
          <Link to={`/read/${slug}`} className="hover:text-accent">
            {title}
          </Link>
        </h3>
        {authorName && (
          <p className="mt-0.5 text-pretty break-words text-sm text-foreground-muted">
            {authorName}
          </p>
        )}

        {reading && (
          <ProgressBar
            value={progressPercent}
            label={t('library.progress')}
            className="mt-3 max-w-44"
          />
        )}

        <OfflineControl bookId={book.id} />

        <div className="eyebrow mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          {finished && <span>{t('library.finished')}</span>}
          {progressUpdatedAt && (
            <span>
              {t('library.lastRead')} {formatDate(new Date(progressUpdatedAt))}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
