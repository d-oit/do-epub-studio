import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { useFocusTrap } from '@do-epub-studio/ui';
import type { TranslationKeys } from '../../../../i18n';
import { Button } from '../../../../components/ui';

export type ReaderExportFormat = 'markdown' | 'html' | 'epub';

interface ExportFormatDialogProps {
  isOpen: boolean;
  isOffline: boolean;
  isExporting: boolean;
  hasError: boolean;
  onClose: () => void;
  onSelect: (format: ReaderExportFormat) => void;
  t: (key: TranslationKeys, params?: Record<string, string | number>) => string;
}

export function ExportFormatDialog({
  isOpen,
  isOffline,
  isExporting,
  hasError,
  onClose,
  onSelect,
  t,
}: ExportFormatDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const offlineMessageId = useId();

  useFocusTrap(isOpen, dialogRef);
  useLayoutEffect(() => {
    if (!isOpen) return;
    const activeElement = document.activeElement;
    previousFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen && previousFocusRef.current && !previousFocusRef.current.isConnected) {
      document.querySelector<HTMLElement>('[aria-haspopup="menu"]')?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && !isExporting) {
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isExporting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="w-full max-w-md rounded-xl border border-border bg-background p-5 text-foreground shadow-xl"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {t('reader.exportDialogTitle')}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm text-foreground-muted">
          {t('reader.exportDialogDescription')}
        </p>
        {isOffline && (
          <p id={offlineMessageId} role="status" className="mt-3 text-sm text-accent-warning">
            {t('reader.exportOnlineOnly')}
          </p>
        )}
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            disabled={isExporting}
            onClick={() => onSelect('markdown')}
            className="min-h-11 rounded-md border border-border px-4 py-2 text-start text-sm font-medium hover:bg-background-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('reader.exportMarkdown')}
          </button>
          <button
            type="button"
            disabled={isOffline || isExporting}
            aria-describedby={isOffline ? offlineMessageId : undefined}
            onClick={() => onSelect('html')}
            className="min-h-11 rounded-md border border-border px-4 py-2 text-start text-sm font-medium hover:bg-background-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('reader.exportHtml')}
          </button>
          <button
            type="button"
            disabled={isOffline || isExporting}
            aria-describedby={isOffline ? offlineMessageId : undefined}
            onClick={() => onSelect('epub')}
            className="min-h-11 rounded-md border border-border px-4 py-2 text-start text-sm font-medium hover:bg-background-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('reader.exportEpub')}
          </button>
        </div>
        {isExporting && (
          <p role="status" aria-live="polite" className="mt-4 text-sm text-foreground-muted">
            {t('reader.exportDownloading')}
          </p>
        )}
        {hasError && (
          <p role="alert" className="mt-4 text-sm text-accent-error">
            {t('reader.exportFailed')}
          </p>
        )}
        <div className="mt-5 flex justify-end">
          <Button variant="ghost" size="sm" disabled={isExporting} onClick={onClose}>
            {t('reader.exportCancel')}
          </Button>
        </div>
      </div>
    </div>
  );
}
