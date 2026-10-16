import type { BookResponse } from '@do-epub-studio/shared';
import type { TFunction } from '../../../hooks/useTranslation';

interface AdminBookCardProps {
  book: BookResponse;
  onEdit: (book: BookResponse) => void;
  onUploadRevision: (book: BookResponse) => void;
  onArchive: (book: BookResponse) => void;
  onManageAccess: (book: BookResponse) => void;
  isArchiving: boolean;
  t: TFunction;
}

export function AdminBookCard({
  book,
  onEdit,
  onUploadRevision,
  onArchive,
  onManageAccess,
  isArchiving,
  t,
}: AdminBookCardProps) {
  return (
    <div className="cq-admin-book-card rounded-sm border border-border bg-surface p-4 shadow-page transition-colors hover:border-accent/40">
      <h3 className="mb-2 font-display text-lg leading-snug text-foreground">{book.title}</h3>
      {book.authorName && <p className="text-sm text-foreground-muted mb-1">{book.authorName}</p>}
      <p className="text-sm text-foreground-muted mb-4 line-clamp-2">
        {book.description || t('admin.books.noDescription')}
      </p>
      <div className="flex flex-wrap justify-between items-center gap-2">
        <span className="text-xs font-medium px-2 py-1 bg-background-tertiary rounded text-foreground-muted uppercase">
          {book.visibility}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(book)}
            className="touch-target inline-flex items-center text-xs font-medium text-foreground-muted hover:text-foreground"
          >
            {t('admin.books.edit')}
          </button>
          <button
            type="button"
            onClick={() => onUploadRevision(book)}
            className="touch-target inline-flex items-center text-xs font-medium text-foreground-muted hover:text-foreground"
          >
            {t('admin.books.uploadRevision')}
          </button>
          <button
            type="button"
            onClick={() => onArchive(book)}
            disabled={isArchiving}
            className="touch-target inline-flex items-center text-xs font-medium text-semantic-error hover:opacity-80 disabled:opacity-50"
          >
            {isArchiving ? '...' : t('admin.books.archive')}
          </button>
          <button
            type="button"
            onClick={() => onManageAccess(book)}
            className="touch-target inline-flex items-center text-sm font-medium text-accent hover:opacity-80"
          >
            {t('admin.books.manageAccess')} &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
