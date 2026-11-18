import { useEffect, useId, useRef, useState } from 'react';
import { useFocusTrap } from '@do-epub-studio/ui';
import { Button, IconButton } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';
import { fetchAnnotationExport } from '../../../lib/api/annotation-export';
import { useAuthStore } from '../../../stores/auth';
import { useReaderStore } from '../../../stores/reader';
import { parseExportFilename, useExportNotes } from '../hooks/useExportNotes';

type ExportFormat = 'markdown' | 'html' | 'epub';

// Named constants: i18next/no-literal-string forbids raw JSX string values,
// and these identifiers double as the canonical format tokens.
/** Shared DOM id: the panel and its trigger must agree for aria-controls. */
export const READER_EXPORT_PANEL_ID = 'reader-export-panel';

const EXPORT_FORMAT_MARKDOWN: ExportFormat = 'markdown';
const EXPORT_FORMAT_HTML: ExportFormat = 'html';
const EXPORT_FORMAT_EPUB: ExportFormat = 'epub';

interface ExportNotesPanelProps {
  onClose: () => void;
}

/**
 * Exclusive "Export notes" side panel. It replaces the old export modal: the
 * panel is a single-active-panel reader surface (like SearchPanel), keeps
 * Markdown available offline, and routes HTML/EPUB through
 * `fetchAnnotationExport`, which supports caller cancellation and a single
 * overall deadline. Closing (or unmounting) aborts any in-flight request, and
 * focus returns to the first visible export trigger after unmount.
 */
export function ExportNotesPanel({ onClose }: ExportNotesPanelProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const formatSelectRef = useRef<HTMLSelectElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const offlineMessageId = useId();
  const sessionMessageId = useId();

  const bookId = useAuthStore((state) => state.bookId);
  const bookTitle = useAuthStore((state) => state.bookTitle);
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const isOffline = useReaderStore((state) => state.isOffline);

  const { handleExportNotes } = useExportNotes();

  const [format, setFormat] = useState<ExportFormat>('markdown');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Cancel/discard in-flight responses when the panel unmounts or the
  // book/session changes underneath it.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    abortRef.current?.abort();
  }, [bookId, sessionToken]);
  useFocusTrap(true, panelRef);

  // The focus trap auto-focuses the first focusable (the close control); run
  // this after it so the primary format control receives initial focus instead.
  useEffect(() => {
    formatSelectRef.current?.focus();
  }, []);

  const canExportOnline = Boolean(bookId && sessionToken) && !isOffline;
  const downloadDisabled = isExporting || (format !== 'markdown' && !canExportOnline);
  const blockedReasonId = isOffline
    ? offlineMessageId
    : !bookId || !sessionToken
      ? sessionMessageId
      : undefined;

  useKeyboardShortcut('Escape', handleClose, { enabled: true });

  function handleClose(): void {
    abortRef.current?.abort();
    onClose();
    // Focus return after unmount: the panel may have been opened from the
    // desktop export button or the mobile overflow menu (whose item is removed
    // when the menu closes), so target the first visible trigger by id.
    requestAnimationFrame(() => {
      const visibleTrigger = (['reader-export-trigger', 'reader-overflow-trigger'] as const)
        .map((id) => document.getElementById(id))
        .find((el): el is HTMLElement => el instanceof HTMLElement && el.offsetParent !== null);
      visibleTrigger?.focus();
    });
  }

  const handleDownload = async () => {
    if (isExporting) return;
    setError(null);

    if (format === 'markdown') {
      setIsExporting(true);
      try {
        // Markdown is generated client-side; no network request, no abort.
        await handleExportNotes(bookTitle);
        handleClose();
      } catch {
        setError(t('reader.export.error'));
      } finally {
        setIsExporting(false);
      }
      return;
    }

    if (!bookId || !sessionToken || isOffline) {
      setError(isOffline ? t('reader.export.onlineRequired') : t('reader.export.sessionRequired'));
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsExporting(true);
    try {
      const blob = await fetchAnnotationExport(bookId, format, sessionToken, controller.signal);
      const currentAuth = useAuthStore.getState();
      if (
        controller.signal.aborted ||
        currentAuth.bookId !== bookId ||
        currentAuth.sessionToken !== sessionToken ||
        useReaderStore.getState().isOffline
      ) {
        return;
      }

      // Client-side filename: reuse the safe markdown basename and replace only
      // the final `.md`; the server Content-Disposition is independently
      // sanitized and is not consulted here.
      const filename = parseExportFilename(bookTitle).replace(/\.md$/, '') + `.${format}`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      handleClose();
    } catch (err) {
      if (controller.signal.aborted || (err as Error)?.name === 'AbortError') {
        // Cancelled by the user or by cleanup — not a failure.
        return;
      }
      setError(t('reader.export.error'));
    } finally {
      setIsExporting(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  return (
    <div
      ref={panelRef}
      id={READER_EXPORT_PANEL_ID}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-container-name="reader-export-panel"
      className="cq cq--reader-export-panel fixed inset-y-0 end-0 w-full sm:w-96 bg-background border-s border-border z-50 flex flex-col animate-slide-in-right"
    >
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 id={titleId} className="text-lg font-semibold text-foreground">
          {t('reader.export.title')}
        </h2>
        <IconButton onClick={handleClose} variant="ghost" aria-label={t('a11y.close')}>
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </IconButton>
      </div>

      <div className="p-4 flex flex-col gap-4">
        <p id={descriptionId} className="text-sm text-foreground-muted">
          {t('reader.export.description')}
        </p>
        {isOffline && (
          <p id={offlineMessageId} role="status" className="text-sm text-accent-warning">
            {t('reader.export.onlineRequired')}
          </p>
        )}
        {!isOffline && (!bookId || !sessionToken) && (
          <p id={sessionMessageId} role="status" className="text-sm text-accent-warning">
            {t('reader.export.sessionRequired')}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor={`${titleId}-format`} className="text-sm font-medium text-foreground">
            {t('reader.export.formatLabel')}
          </label>
          <select
            ref={formatSelectRef}
            id={`${titleId}-format`}
            value={format}
            onChange={(event) => setFormat(event.target.value as ExportFormat)}
            disabled={isExporting}
            aria-describedby={blockedReasonId}
            className="min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value={EXPORT_FORMAT_MARKDOWN}>{t('reader.export.markdown')}</option>
            <option value={EXPORT_FORMAT_HTML} disabled={!canExportOnline}>
              {t('reader.export.html')}
            </option>
            <option value={EXPORT_FORMAT_EPUB} disabled={!canExportOnline}>
              {t('reader.export.epub')}
            </option>
          </select>
        </div>

        {isExporting && (
          <p role="status" aria-live="polite" className="text-sm text-foreground-muted">
            {t('reader.export.downloading')}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-accent-error">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="md"
            disabled={downloadDisabled}
            onClick={() => void handleDownload()}
          >
            {t('reader.export.download')}
          </Button>
          {isExporting && format !== 'markdown' && (
            <Button variant="secondary" size="md" onClick={() => abortRef.current?.abort()}>
              {t('reader.export.cancel')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
