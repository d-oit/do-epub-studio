import type { AuthorPublication, PublishManuscriptResponse } from '@do-epub-studio/shared';
import { Modal, Button } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';

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
  const { t } = useTranslation();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('author.publish.modalTitle')}>
      {publishResult ? (
        <div className="space-y-4 py-4 text-center">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="mx-auto h-12 w-12 text-semantic-success"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="m8 12 2.5 2.5L16 9" />
          </svg>
          <h3 className="text-lg font-bold text-foreground">{t('author.publish.successTitle')}</h3>
          <p className="text-sm text-foreground-muted">
            {t('author.publish.revision', { revision: publishResult.revision })}{' '}
            {t('author.publish.successDescription', { title: publication.title })}
          </p>
          <div className="space-y-1 rounded border border-border bg-background-secondary p-3 text-left font-mono text-xs">
            <div>
              <span className="text-foreground-muted">{t('author.publish.shaLabel')}</span>{' '}
              {publishResult.sha256.slice(0, 24)}…
            </div>
            <div>
              <span className="text-foreground-muted">{t('author.publish.sizeLabel')}</span>{' '}
              {Math.round(publishResult.fileSize / 1024)} {t('author.publish.kib')}
            </div>
          </div>
          <div className="flex justify-center gap-3 pt-4">
            <Button onClick={onBackToBooks}>{t('author.publish.done')}</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-foreground-muted">
            {t('author.publish.description', { count: publication.chapters.length })}
          </p>

          <div className="rounded border border-border bg-surface p-3 text-sm">
            <div className="font-semibold text-foreground">{publication.title}</div>
            <div className="text-xs text-foreground-muted">
              {t('author.publish.byline', {
                creators: publication.creators.join(', '),
                language: publication.language,
              })}
            </div>
          </div>

          {publishError && (
            <div
              className="rounded bg-semantic-error/10 p-3 text-sm text-semantic-error"
              role="alert"
            >
              {publishError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={onClose} disabled={isPublishing}>
              {t('author.publish.cancel')}
            </Button>
            <Button variant="primary" onClick={() => void onPublish()} disabled={isPublishing}>
              {isPublishing ? t('author.publish.publishing') : t('author.publish.confirm')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
