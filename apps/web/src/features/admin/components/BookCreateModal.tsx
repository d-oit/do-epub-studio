import { useTranslation } from '../../../hooks/useTranslation';
import { Modal, Button } from '../../../components/ui';

interface BookCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
  bookTitle: string;
  setBookTitle: (v: string) => void;
  authorName: string;
  setAuthorName: (v: string) => void;
  epubFile: File | null;
  setEpubFile: (f: File | null) => void;
  visibility: string;
  setVisibility: (v: string) => void;
  isSubmitting: boolean;
  createError: string | null;
  validationResult: { isValid: boolean; errors: string[]; warnings: string[] } | null;
}

export function BookCreateModal({
  isOpen,
  onClose,
  onSubmit,
  bookTitle,
  setBookTitle,
  authorName,
  setAuthorName,
  setEpubFile,
  visibility,
  setVisibility,
  isSubmitting,
  createError,
  validationResult,
}: BookCreateModalProps) {
  const { t } = useTranslation();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('admin.createBookModal.title')}>
      <form onSubmit={(e) => { void onSubmit(e); }} className="space-y-4">
        <div>
          <label htmlFor="book-title" className="block text-sm font-medium text-foreground-muted mb-1">
            {t('admin.createBookModal.titleLabel')}
          </label>
          <input
            id="book-title"
            type="text"
            value={bookTitle}
            onChange={(e) => { setBookTitle(e.target.value); }}
            placeholder={t('admin.createBookModal.titlePlaceholder')}
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
          />
        </div>

        <div>
          <label htmlFor="book-author" className="block text-sm font-medium text-foreground-muted mb-1">
            {t('admin.createBookModal.authorLabel')}
          </label>
          <input
            id="book-author"
            type="text"
            value={authorName}
            onChange={(e) => { setAuthorName(e.target.value); }}
            placeholder={t('admin.createBookModal.authorPlaceholder')}
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
          />
        </div>

        <div>
          <label htmlFor="book-epub" className="block text-sm font-medium text-foreground-muted mb-1">
            {t('admin.createBookModal.epubLabel')}
          </label>
          <input
            id="book-epub"
            type="file"
            accept=".epub"
            onChange={(e) => { setEpubFile(e.target.files?.[0] ?? null); }}
            className="w-full text-sm text-foreground-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-accent/10 file:text-accent hover:file:bg-accent/20 cursor-pointer"
          />
        </div>

        <div>
          <label htmlFor="book-visibility" className="block text-sm font-medium text-foreground-muted mb-1">
            {t('admin.createBookModal.visibilityLabel')}
          </label>
          <select
            id="book-visibility"
            value={visibility}
            onChange={(e) => { setVisibility(e.target.value); }}
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
          >
            <option value="private">{t('admin.createBookModal.visibilityPrivate')}</option> {/* eslint-disable-line i18next/no-literal-string -- form option value */}
            <option value="public">{t('admin.createBookModal.visibilityPublic')}</option> {/* eslint-disable-line i18next/no-literal-string -- form option value */}
          </select>
        </div>

        {createError && (
          <div className="p-3 bg-semantic-error/10 border border-semantic-error/30 rounded-lg text-sm text-semantic-error">
            {createError}
          </div>
        )}

        {validationResult && !validationResult.isValid && (
          <div className="p-3 bg-semantic-error/10 border border-semantic-error/30 rounded-lg text-sm text-semantic-error">
            <p className="font-bold mb-1">{t('admin.createBookModal.validationErrors')}</p>
            <ul className="list-disc list-inside">
              {validationResult.errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {validationResult && validationResult.warnings.length > 0 && (
          <div className="p-3 bg-semantic-warning/10 border border-semantic-warning/30 rounded-lg text-sm text-semantic-warning">
            <p className="font-bold mb-1">{t('admin.createBookModal.validationWarnings')}</p>
            <ul className="list-disc list-inside">
              {validationResult.warnings.map((warn) => (
                <li key={warn}>{warn}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('admin.createBookModal.close')}
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {isSubmitting ? t('admin.createBookModal.submitting') : t('admin.createBookModal.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
