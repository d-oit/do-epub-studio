import type { AuthorPublication, PublishManuscriptResponse } from '@do-epub-studio/shared';
import { Modal, Button } from '../../../components/ui';

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  publication: AuthorPublication;
  publishResult: PublishManuscriptResponse | null;
  publishError: string | null;
  isPublishing: boolean;
  onPublish: () => void | Promise<void>;
  onBackToBooks: () => void;
}

const PUBLISH_TEXT = {
  modalTitle: 'Publish EPUB 3 Publication',
  successTitle: 'Publication Published!',
  successDesc: 'has been generated as a valid EPUB 3 archive and committed to immutable storage.',
  shaLabel: 'SHA-256:',
  sizeLabel: 'Size:',
  backToAdminBooks: 'Back to Admin Books',
  cancel: 'Cancel',
  publishingText: 'Packaging & Publishing...',
  confirmPublish: 'Confirm & Publish',
  checkmark: '✓',
  kib: 'KiB',
} as const;

export function PublishModal({
  isOpen,
  onClose,
  publication,
  publishResult,
  publishError,
  isPublishing,
  onPublish,
  onBackToBooks,
}: PublishModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={PUBLISH_TEXT.modalTitle}>
      {publishResult ? (
        <div className="space-y-4 text-center py-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-semantic-success/20 text-semantic-success text-2xl font-bold">
            {PUBLISH_TEXT.checkmark}
          </div>
          <h3 className="text-lg font-bold text-foreground">{PUBLISH_TEXT.successTitle}</h3>
          <p className="text-sm text-foreground-muted">
            {`Revision #${publishResult.revision} ${PUBLISH_TEXT.successDesc}`}
          </p>
          <div className="rounded border border-border bg-background-secondary p-3 text-xs text-left font-mono space-y-1">
            <div>
              <span className="text-foreground-muted">{PUBLISH_TEXT.shaLabel}</span>{' '}
              {publishResult.sha256.slice(0, 24)}...
            </div>
            <div>
              <span className="text-foreground-muted">{PUBLISH_TEXT.sizeLabel}</span>{' '}
              {Math.round(publishResult.fileSize / 1024)} {PUBLISH_TEXT.kib}
            </div>
          </div>
          <div className="flex justify-center gap-3 pt-4">
            <Button onClick={onBackToBooks}>{PUBLISH_TEXT.backToAdminBooks}</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-foreground-muted">
            {`Publishing will compile your ${publication.chapters.length} chapter(s) into a deterministic, conformant EPUB 3 archive and publish it as an immutable revision.`}
          </p>

          <div className="rounded border border-border bg-surface p-3 text-sm">
            <div className="font-semibold text-foreground">{publication.title}</div>
            <div className="text-xs text-foreground-muted">
              {`by ${publication.authorName} • ${publication.language}`}
            </div>
          </div>

          {publishError && (
            <div className="rounded bg-semantic-error/10 p-3 text-sm text-semantic-error">
              {publishError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={onClose} disabled={isPublishing}>
              {PUBLISH_TEXT.cancel}
            </Button>
            <Button variant="primary" onClick={() => void onPublish()} disabled={isPublishing}>
              {isPublishing ? PUBLISH_TEXT.publishingText : PUBLISH_TEXT.confirmPublish}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
