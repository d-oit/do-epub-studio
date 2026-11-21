import { useEffect, useRef } from 'react';
import { Modal, Button } from '@do-epub-studio/ui';
import { ConflictPreviewDialog } from './ConflictPreviewDialog';
import { useTranslation } from '../../hooks/useTranslation';
import { usePortability } from '../../hooks/usePortability';
interface PortabilityDialogProps {
  isOpen: boolean;
  scope: 'book' | 'account';
  bookId?: string | null;
  bookTitle?: string | null;
  bookSlug?: string | null;
  onClose: () => void;
}

/**
 * Export / restore dialog for data portability. Presents export (with an
 * explicit opt-in for bundling EPUB files) and import (parse → conflict
 * preview → confirm). Import preview is non-mutating.
 */
export function PortabilityDialog({
  isOpen,
  scope,
  bookId,
  bookTitle,
  bookSlug,
  onClose,
}: PortabilityDialogProps) {
  const { t } = useTranslation();
  const {
    state,
    open,
    close,
    setIncludeBookFiles,
    exportArchive,
    importFile,
    confirmImport,
  } = usePortability();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      open(scope, bookId ? { id: bookId, title: bookTitle ?? null, slug: bookSlug ?? '' } : undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open is stable enough; re-open only on visibility change
  }, [isOpen, scope, bookId, bookTitle, bookSlug]);

  if (!isOpen) return null;

  return (
    <>
      <Modal isOpen={state.isOpen} onClose={onClose} title={t('portability.title')}>
        <p className="text-sm text-foreground-muted">{t('portability.description')}</p>

        <div className="mt-5 space-y-4">
          <div className="rounded-lg border border-border bg-background-secondary p-4">
            <h3 className="text-sm font-semibold text-foreground">
              {scope === 'account' ? t('portability.exportAll') : t('portability.exportBook')}
            </h3>
            {scope === 'account' && (
              <label className="mt-3 flex items-start gap-2 text-sm text-foreground-muted">
                <input
                  type="checkbox"
                  checked={state.includeBookFiles}
                  onChange={(e) => setIncludeBookFiles(e.target.checked)}
                  className="mt-1 accent-accent"
                />
                <span>
                  <span className="block font-medium text-foreground">
                    {t('portability.includeBookFiles')}
                  </span>
                  <span className="block">{t('portability.includeBookFilesHint')}</span>
                </span>
              </label>
            )}
            <Button className="mt-3" onClick={() => void exportArchive()} isLoading={state.isAnalyzing}>
              {t('portability.exportAll')}
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-background-secondary p-4">
            <h3 className="text-sm font-semibold text-foreground">{t('portability.importTitle')}</h3>
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => fileInputRef.current?.click()}
              isLoading={state.isAnalyzing}
            >
              {scope === 'account' ? t('portability.importAll') : t('portability.importBook')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.zip,application/json,application/zip"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importFile(file);
                e.target.value = '';
              }}
            />
          </div>

          {state.lastResult && (
            <p role="status" className="text-sm text-foreground">
              {state.lastResult}
            </p>
          )}
          {state.error && (
            <p role="alert" className="text-sm text-accent-error">
              {state.error}
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            {t('portability.cancel')}
          </Button>
        </div>
      </Modal>

      <ConflictPreviewDialog
        isOpen={Boolean(state.preview)}
        preview={state.preview}
        isApplying={state.isApplying}
        error={state.error}
        onClose={() => close()}
        onConfirm={() => void confirmImport()}
      />
    </>
  );
}
