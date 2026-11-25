import { Modal, Button } from '@do-epub-studio/ui';
import type { PortabilityPreview } from '../../lib/portability/import';
import { useTranslation } from '../../hooks/useTranslation';
interface ConflictPreviewDialogProps {
  isOpen: boolean;
  preview: PortabilityPreview | null;
  isApplying: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Non-mutating conflict preview. Renders the analysis of a parsed portability
 * envelope (duplicates, conflicts, re-anchor quality) and does nothing until
 * the user explicitly confirms; confirming applies the *plan* via the API.
 */
export function ConflictPreviewDialog({
  isOpen,
  preview,
  isApplying,
  error,
  onClose,
  onConfirm,
}: ConflictPreviewDialogProps) {
  const { t } = useTranslation();
  if (!isOpen) return null;
  const summary = preview?.summary;
  const totalReanchor = preview
    ? preview.publications.reduce(
        (acc, p) => ({
          exact: acc.exact + p.reanchorReport.exact,
          weak: acc.weak + p.reanchorReport.weak,
          unanchored: acc.unanchored + p.reanchorReport.unanchored,
        }),
        { exact: 0, weak: 0, unanchored: 0 },
      )
    : { exact: 0, weak: 0, unanchored: 0 };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('portability.previewTitle')} size="lg">
      <div className="text-sm text-foreground-muted">{t('portability.previewDescription')}</div>

      {summary && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t('portability.books')} value={summary.books} />
          <Stat label={t('portability.newAnnotations')} value={summary.newAnnotations} />
          <Stat label={t('portability.duplicates')} value={summary.duplicateAnnotations} />
          <Stat label={t('portability.conflicts')} value={summary.conflictAnnotations} />
        </div>
      )}

      {preview && preview.publications.length > 0 && (
        <div className="mt-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            {t('portability.reanchorTitle')}
          </h3>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-background-secondary px-3 py-1 text-foreground">
              {t('portability.exact', { count: totalReanchor.exact })}
            </span>
            <span className="rounded-full bg-background-secondary px-3 py-1 text-foreground">
              {t('portability.weak', { count: totalReanchor.weak })}
            </span>
            <span className="rounded-full bg-background-secondary px-3 py-1 text-foreground">
              {t('portability.unanchored', { count: totalReanchor.unanchored })}
            </span>
          </div>

          <ul className="max-h-56 overflow-y-auto rounded-lg border border-border bg-background p-3 text-sm">
            {preview.publications.map((p) => (
              <li
                key={p.bookId}
                className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0"
              >
                <span className="min-w-0 truncate text-foreground">{p.title}</span>
                <span className="shrink-0 text-xs text-foreground-muted">
                  {t('portability.bookSummary', {
                    new: p.annotations.filter((a) => a.status === 'new').length,
                    duplicate: p.annotations.filter((a) => a.status === 'duplicate').length,
                    conflict: p.annotations.filter((a) => a.status === 'conflict').length,
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-accent-error">
          {error}
        </p>
      )}
      {preview && preview.missingBooks.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-semibold text-foreground">{t('portability.skippedBooks')}</p>
          <ul className="rounded-lg border border-border bg-background p-3 text-sm">
            {preview.missingBooks.map((book) => (
              <li key={book.bookId} className="flex items-center justify-between gap-3 py-1">
                <span className="min-w-0 truncate text-foreground">{book.title}</span>
                <span className="shrink-0 text-xs text-foreground-muted">
                  {t('portability.skippedBookBadge')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-5 text-xs text-foreground-muted">{t('portability.nonMutating')}</p>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={isApplying}>
          {t('portability.cancel')}
        </Button>
        <Button onClick={onConfirm} isLoading={isApplying} loadingLabel={t('portability.applying')}>
          {t('portability.confirmImport')}
        </Button>
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-background-secondary p-3 text-center">
      <div className="text-xl font-bold text-foreground">{value}</div>
      <div className="mt-1 text-xs text-foreground-muted">{label}</div>
    </div>
  );
}
