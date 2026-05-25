import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { BookResponse } from '@do-epub-studio/shared';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { Modal, Button } from '../../components/ui';

interface CreateBookResponse {
  id: string;
  uploadUrl: string;
}

export function AdminBookResponsesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [books, setBookResponses] = useState<BookResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [bookTitle, setBookTitle] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [epubFile, setEpubFile] = useState<File | null>(null);
  const [visibility, setVisibility] = useState('private');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBookResponses = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest<BookResponse[]>('/api/admin/books');
      setBookResponses(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchBookResponses();
  }, []);

  const handleViewGrants = (book: BookResponse) => {
    void navigate(`/admin/books/${book.id}/grants`, { state: { bookTitle: book.title } });
  };

  const handleBackToReader = () => {
    void navigate('/login');
  };

  const resetCreateForm = () => {
    setBookTitle('');
    setAuthorName('');
    setEpubFile(null);
    setVisibility('private');
    setCreateError(null);
    setValidationResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validateEpubLocal = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(data);
      const errors: string[] = [];
      const warnings: string[] = [];

      const mimetype = zip.file('mimetype');
      if (!mimetype) {
        errors.push(t('admin.createBookModal.error.missingMimetype'));
      } else {
        const content = (await mimetype.async('string')).trim();
        if (content !== 'application/epub+zip') {
          errors.push(t('admin.createBookModal.error.invalidMimetype'));
        }
      }

      const container = zip.file('META-INF/container.xml');
      if (!container) {
        errors.push(t('admin.createBookModal.error.missingContainer'));
      }

      setValidationResult({
        isValid: errors.length === 0,
        errors,
        warnings,
      });
      return errors.length === 0;
    } catch {
      setCreateError(t('admin.createBookModal.error.corruptZip'));
      return false;
    }
  };

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!bookTitle.trim()) {
      setCreateError(t('admin.createBookModal.error.fillFields'));
      return;
    }

    if (!epubFile) {
      setCreateError(t('admin.createBookModal.error.selectEpub'));
      return;
    }

    const isLocalValid = await validateEpubLocal(epubFile);
    if (!isLocalValid) {
      return;
    }

    setIsSubmitting(true);

    try {
      const createResult = await apiRequest<CreateBookResponse>('/api/admin/books', {
        method: 'POST',
        body: JSON.stringify({
          title: bookTitle.trim(),
          authorName: authorName.trim() || null,
          visibility,
        }),
      });

      const uploadUrl = createResult.uploadUrl;
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: epubFile,
        headers: { 'Content-Type': 'application/octet-stream' },
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json() as { error?: { code?: string, message: string, details?: string[] } };
        if (errorData.error?.code === 'VALIDATION_ERROR' && errorData.error.details) {
          setValidationResult({
            isValid: false,
            errors: errorData.error.details,
            warnings: [],
          });
          throw new Error(errorData.error.message);
        }
        throw new Error(t('admin.createBookModal.error.upload'));
      }

      const uploadResult = await uploadResponse.json() as {
        data: {
          storageKey: string,
          validation?: { isValid: boolean, errors: string[], warnings: string[] }
        }
      };

      await apiRequest(`/api/admin/books/${createResult.id}/upload-complete`, {
        method: 'POST',
        body: JSON.stringify({
          storageKey: uploadResult.data.storageKey,
          originalFilename: epubFile.name,
          fileSizeBytes: epubFile.size,
          mimeType: epubFile.type || 'application/epub+zip',
          validationResults: uploadResult.data.validation,
        }),
      });

      if (uploadResult.data.validation) {
        setValidationResult(uploadResult.data.validation);
      }

      setIsCreateModalOpen(false);
      resetCreateForm();
      setSuccessMessage(t('admin.createBookModal.success'));
      void fetchBookResponses();

      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('admin.books.title')}
          </h1>
          <button
            onClick={handleBackToReader}
            className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 mt-1"
          >
            &larr; {t('admin.books.backToReader')}
          </button>
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={() => setIsCreateModalOpen(true)}>
            {t('admin.createBook')}
          </Button>
          <button
            onClick={() => void navigate('/admin/audit-logs')}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {t('admin.books.viewAuditLogs')}
          </button>
          <LocaleSwitcher />
        </div>
      </header>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300">
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full py-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          books.map((book) => (
            <div
              key={book.id}
              className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {book.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                {book.description || t('admin.books.noDescription')}
              </p>
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300 uppercase">
                  {book.visibility}
                </span>
                <button
                  onClick={() => handleViewGrants(book)}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
                >
                  {t('admin.books.manageAccess')} &rarr;
                </button>
              </div>
            </div>
          ))
        )}
        {!isLoading && books.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400">
            {t('admin.books.noBookResponses')}
          </div>
        )}
      </div>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          resetCreateForm();
        }}
        title={t('admin.createBookModal.title')}
      >
        <form onSubmit={(e) => { void handleCreateBook(e); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('admin.createBookModal.titleLabel')}
            </label>
            <input
              type="text"
              value={bookTitle}
              onChange={(e) => setBookTitle(e.target.value)}
              placeholder={t('admin.createBookModal.titlePlaceholder')}
              className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('admin.createBookModal.authorLabel')}
            </label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder={t('admin.createBookModal.authorPlaceholder')}
              className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('admin.createBookModal.epubLabel')}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".epub"
              onChange={(e) => setEpubFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 dark:file:bg-primary-900/30 file:text-primary-700 dark:file:text-primary-300 hover:file:bg-primary-100 dark:hover:file:bg-primary-900/50 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('admin.createBookModal.visibilityLabel')}
            </label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
            >
              <option value="private">{t('admin.createBookModal.visibilityPrivate')}</option>
              <option value="public">{t('admin.createBookModal.visibilityPublic')}</option>
            </select>
          </div>

          {createError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
              {createError}
            </div>
          )}

          {validationResult && !validationResult.isValid && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
              <p className="font-bold mb-1">{t('admin.createBookModal.validationErrors')}</p>
              <ul className="list-disc list-inside">
                {validationResult.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {validationResult && validationResult.warnings.length > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
              <p className="font-bold mb-1">{t('admin.createBookModal.validationWarnings')}</p>
              <ul className="list-disc list-inside">
                {validationResult.warnings.map((warn, i) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsCreateModalOpen(false);
                resetCreateForm();
              }}
            >
              {t('admin.createBookModal.close')}
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
            >
              {isSubmitting ? t('admin.createBookModal.submitting') : t('admin.createBookModal.submit')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
