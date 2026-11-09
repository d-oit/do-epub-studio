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
  createMode?: 'upload' | 'author';
  setCreateMode?: (m: 'upload' | 'author') => void;
  authorTemplate?: 'blank' | 'novel' | 'guide';
  setAuthorTemplate?: (t: 'blank' | 'novel' | 'guide') => void;
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
  createMode = 'upload',
  setCreateMode,
  authorTemplate = 'blank',
  setAuthorTemplate,
  visibility,
  setVisibility,
  isSubmitting,
  createError,
  validationResult,
}: BookCreateModalProps) {
  const { t } = useTranslation();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('admin.createBookModal.title')}>
      <form
        onSubmit={(e) => {
          void onSubmit(e);
        }}
        className="space-y-4"
      >
        {setCreateMode && (
          <div
            role="group"
            aria-label={t('admin.createBookModal.modeLabel')}
            className="flex flex-wrap rounded-sm border border-border bg-background-tertiary p-1"
          >
            <button
              type="button"
              onClick={() => setCreateMode('upload')}
              aria-pressed={createMode === 'upload'}
              className={`touch-target min-h-11 flex-1 rounded-sm px-3 text-sm font-semibold transition-colors ${
                createMode === 'upload'
                  ? 'bg-surface text-foreground shadow-sm'
                  : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              {t('admin.createBookModal.uploadMode')}
            </button>
            <button
              type="button"
              onClick={() => setCreateMode('author')}
              aria-pressed={createMode === 'author'}
              className={`touch-target min-h-11 flex-1 rounded-sm px-3 text-sm font-semibold transition-colors ${
                createMode === 'author'
                  ? 'bg-surface text-foreground shadow-sm'
                  : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              {t('admin.createBookModal.authorMode')}
            </button>
          </div>
        )}
        <div>
          <label
            htmlFor="book-title"
            className="block text-sm font-medium text-foreground-muted mb-1"
          >
            {t('admin.createBookModal.titleLabel')}
          </label>
          <input
            id="book-title"
            type="text"
            value={bookTitle}
            onChange={(e) => {
              setBookTitle(e.target.value);
            }}
            placeholder={t('admin.createBookModal.titlePlaceholder')}
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
          />
        </div>

        <div>
          <label
            htmlFor="book-author"
            className="block text-sm font-medium text-foreground-muted mb-1"
          >
            {t('admin.createBookModal.authorLabel')}
          </label>
          <input
            id="book-author"
            type="text"
            value={authorName}
            onChange={(e) => {
              setAuthorName(e.target.value);
            }}
            placeholder={t('admin.createBookModal.authorPlaceholder')}
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
          />
        </div>

        {createMode === 'author' && setAuthorTemplate ? (
          <div>
            <label
              htmlFor="book-template"
              className="block text-sm font-medium text-foreground-muted mb-1"
            >
              {t('admin.createBookModal.templateLabel')}
            </label>
            <select
              id="book-template"
              value={authorTemplate}
              onChange={(e) => {
                setAuthorTemplate(e.target.value as 'blank' | 'novel' | 'guide');
              }}
              className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
            >
              {/* eslint-disable-next-line i18next/no-literal-string -- form option value */}
              <option value="blank">{t('admin.createBookModal.templateBlank')}</option>
              {/* eslint-disable-next-line i18next/no-literal-string -- form option value */}
              <option value="novel">{t('admin.createBookModal.templateNovel')}</option>
              {/* eslint-disable-next-line i18next/no-literal-string -- form option value */}
              <option value="guide">{t('admin.createBookModal.templateGuide')}</option>
            </select>
          </div>
        ) : (
          <div>
            <label
              htmlFor="book-epub"
              className="block text-sm font-medium text-foreground-muted mb-1"
            >
              {t('admin.createBookModal.epubLabel')}
            </label>
            <input
              id="book-epub"
              type="file"
              accept=".epub"
              onChange={(e) => {
                setEpubFile(e.target.files?.[0] ?? null);
              }}
              className="w-full text-sm text-foreground-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-accent/10 file:text-accent hover:file:bg-accent/20 cursor-pointer"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="book-visibility"
            className="block text-sm font-medium text-foreground-muted mb-1"
          >
            {t('admin.createBookModal.visibilityLabel')}
          </label>
          <select
            id="book-visibility"
            value={visibility}
            onChange={(e) => {
              setVisibility(e.target.value);
            }}
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
          >
            {/* eslint-disable-next-line i18next/no-literal-string -- form option value */}
            <option value="private">{t('admin.createBookModal.visibilityPrivate')}</option>{' '}
            {/* eslint-disable-next-line i18next/no-literal-string -- form option value; the disable must precede the <option> because prettier's inserted {' '} separators push a trailing disable-line onto the wrong node */}
            <option value="public">{t('admin.createBookModal.visibilityPublic')}</option>
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
            {isSubmitting
              ? t('admin.createBookModal.submitting')
              : createMode === 'author'
                ? t('admin.createBookModal.submitAuthor')
                : t('admin.createBookModal.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
