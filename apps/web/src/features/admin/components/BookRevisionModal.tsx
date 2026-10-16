import { useTranslation } from '../../../hooks/useTranslation';
import { Modal, Button } from '../../../components/ui';

interface BookRevisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
  bookTitle: string;
  epubFile: File | null;
  setEpubFile: (f: File | null) => void;
  isSubmitting: boolean;
  error: string | null;
  validationResult: { isValid: boolean; errors: string[]; warnings: string[] } | null;
}

export function BookRevisionModal({
  isOpen,
  onClose,
  onSubmit,
  bookTitle,
  epubFile,
  setEpubFile,
  isSubmitting,
  error,
  validationResult,
}: BookRevisionModalProps) {
  const { t } = useTranslation();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('admin.books.uploadRevision')}>
      <form
        onSubmit={(e) => {
          void onSubmit(e);
        }}
        className="space-y-4"
      >
        <p className="text-sm font-medium text-foreground">{bookTitle}</p>

        <div>
          <label
            htmlFor="revision-epub-file"
            className="block text-sm font-medium text-foreground-muted mb-1"
          >
            {t('admin.createBookModal.epubLabel')}
          </label>
          <input
            id="revision-epub-file"
            type="file"
            accept=".epub,application/epub+zip"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              setEpubFile(file);
            }}
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-white hover:file:opacity-90 cursor-pointer"
          />
        </div>

        {error && (
          <div className="p-3 bg-semantic-error/10 border border-semantic-error/30 rounded-lg text-sm text-semantic-error">
            {error}
          </div>
        )}

        {validationResult && !validationResult.isValid && (
          <div className="p-3 bg-semantic-error/10 border border-semantic-error/30 rounded-lg text-sm text-semantic-error">
            <p className="font-medium mb-1">{t('admin.createBookModal.validationErrors')}</p>
            <ul className="list-disc list-inside space-y-1">
              {validationResult.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            {t('annotation.cancel')}
          </Button>
          <Button type="submit" disabled={!epubFile || isSubmitting} isLoading={isSubmitting}>
            {isSubmitting ? t('admin.createBookModal.submitting') : t('admin.books.uploadRevision')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
