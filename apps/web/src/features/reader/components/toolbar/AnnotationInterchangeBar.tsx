import { useTranslation } from '../../../../hooks/useTranslation';
import { useAnnotationInterchange } from '../../hooks/useAnnotationInterchange';

export function AnnotationInterchangeBar({
  bookId,
  bookTitle,
  onError,
}: {
  bookId: string | null;
  bookTitle: string | null;
  onError: (msg: string) => void;
}) {
  const { t } = useTranslation();
  const { exportDraft, importDraft } = useAnnotationInterchange(bookId, bookTitle);

  return (
    <section
      className="mt-16 flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border"
      aria-label={t('reader.annotationInterchangeDraft')}
    >
      <span className="text-sm text-foreground-muted">
        {t('reader.annotationInterchangeDraft')}
      </span>
      <button
        type="button"
        className="rounded-md px-3 py-1.5 text-sm text-foreground bg-muted hover:bg-muted/80"
        onClick={() => void exportDraft()}
      >
        {t('reader.exportInterchangeDraft')}
      </button>
      <label className="rounded-md px-3 py-1.5 text-sm text-foreground bg-muted hover:bg-muted/80 cursor-pointer focus-within:outline-none focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2">
        {t('reader.importInterchangeDraft')}
        <input
          className="sr-only"
          type="file"
          accept=".json,application/json"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) {
              void importDraft(file).catch((error: unknown) =>
                onError(error instanceof Error ? error.message : 'Annotation import failed'),
              );
            }
            event.currentTarget.value = '';
          }}
        />
      </label>
    </section>
  );
}
