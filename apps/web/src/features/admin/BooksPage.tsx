import { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import type { BookResponse } from '@do-epub-studio/shared';
import { validateEpub } from '@do-epub-studio/shared';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { Button, ConfirmDialog } from '../../components/ui';
import { Spinner } from '@do-epub-studio/ui';
import { BookCreateModal } from './components/BookCreateModal';
import { BookEditModal } from './components/BookEditModal';

interface CreateBookResponse {
  id: string;
  uploadUrl: string;
}

export function AdminBookResponsesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sessionToken = useAuthStore((state) => state.sessionToken);
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

  const [editingBook, setEditingBook] = useState<BookResponse | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVisibility, setEditVisibility] = useState('private');
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [archivingBookId, setArchivingBookId] = useState<string | null>(null);
  const [archiveConfirmBook, setArchiveConfirmBook] = useState<BookResponse | null>(null);

  const fetchBookResponses = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest<BookResponse[]>('/api/admin/books', { token: sessionToken ?? undefined });
      setBookResponses(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    void fetchBookResponses();
  }, [fetchBookResponses]);

  const handleViewGrants = (book: BookResponse) => {
    void navigate(`/admin/books/${book.id}/grants`, { state: { bookTitle: book.title } });
  };

  const handleBackToReader = () => {
    void navigate('/login');
  };

  const openEditModal = (book: BookResponse) => {
    setEditingBook(book);
    setEditTitle(book.title);
    setEditAuthor(book.authorName ?? '');
    setEditDescription(book.description ?? '');
    setEditVisibility(book.visibility);
    setEditError(null);
  };

  const handleUpdateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBook) return;
    setEditError(null);
    setIsEditSubmitting(true);

    try {
      await apiRequest(`/api/admin/books/${editingBook.id}`, {
        method: 'PATCH',
        token: sessionToken ?? undefined,
        body: JSON.stringify({
          title: editTitle.trim(),
          authorName: editAuthor.trim() || null,
          description: editDescription.trim() || null,
          visibility: editVisibility,
        }),
      });
      setEditingBook(null);
      setSuccessMessage(t('admin.books.updateSuccess'));
      void fetchBookResponses();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setEditError((err as Error).message);
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleArchiveBook = async (bookId: string) => {
    setArchivingBookId(bookId);
    try {
      await apiRequest(`/api/admin/books/${bookId}`, {
        method: 'DELETE',
        token: sessionToken ?? undefined,
      });
      setSuccessMessage(t('admin.books.archiveSuccess'));
      void fetchBookResponses();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setArchivingBookId(null);
      setArchiveConfirmBook(null);
    }
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
      const result = await validateEpub(data);

      const localizedErrors = result.errors.map(err => {
        if (err.includes('mimetype')) return t('admin.createBookModal.error.missingMimetype');
        if (err.includes('META-INF/container.xml')) return t('admin.createBookModal.error.missingContainer');
        return err;
      });

      setValidationResult({
        ...result,
        errors: localizedErrors,
      });
      return result.isValid;
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

    const slug = bookTitle.trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 255) || 'untitled';

    setIsSubmitting(true);

    try {
      const createResult = await apiRequest<CreateBookResponse>('/api/admin/books', {
        method: 'POST',
        token: sessionToken ?? undefined,
        body: JSON.stringify({
          title: bookTitle.trim(),
          slug,
          authorName: authorName.trim() || null,
          visibility,
        }),
      });

      const uploadUrl = createResult.uploadUrl;
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: epubFile,
        headers: { 'Authorization': `Bearer ${sessionToken ?? ''}`, 'Content-Type': 'application/octet-stream' },
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
        token: sessionToken ?? undefined,
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

  // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -- Codacy rule contradicts no-floating-promises; void required locally
  const handleAuditNav = () => { void navigate('/admin/audit'); };

  return (
    <main id="main-content" className="min-dvh bg-background p-4 sm:p-6 lg:p-8">
      <header className="flex justify-between flex-wrap gap-4 items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('admin.books.title')}
          </h1>
          <button
            onClick={handleBackToReader}
            className="text-sm text-accent hover:opacity-80 mt-1"
          >
            &larr; {t('admin.books.backToReader')}
          </button>
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={() => setIsCreateModalOpen(true)}>
            {t('admin.createBook')}
          </Button>
          <button
            onClick={handleAuditNav}
            className="px-4 py-2 bg-background border border-border rounded-md text-sm font-medium text-foreground-muted hover:bg-background-secondary"
          >
            {t('admin.books.viewAuditLogs')}
          </button>
          <LocaleSwitcher />
        </div>
      </header>

      {error && (
        <div className="mb-6 p-4 bg-semantic-error/10 border border-semantic-error/30 rounded-lg text-semantic-error">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 bg-semantic-success/10 border border-semantic-success/30 rounded-lg text-semantic-success">
          {successMessage}
        </div>
      )}

      <div
        data-container-name="admin-books-grid"
        className="cq cq--admin-books-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {isLoading ? (
          <div className="col-span-full py-12 flex justify-center">
            <Spinner />
          </div>
        ) : (
          books.map((book) => (
            <div
              key={book.id}
              className="cq-admin-book-card bg-background-secondary p-6 rounded-xl shadow-sm border border-border hover:shadow-md transition-shadow"
            >
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {book.title}
              </h3>
              <p className="text-sm text-foreground-muted mb-4 line-clamp-2">
                {book.description || t('admin.books.noDescription')}
              </p>
              <div className="flex flex-wrap justify-between items-center gap-2">
                <span className="text-xs font-medium px-2 py-1 bg-background-tertiary rounded text-foreground-muted uppercase">
                  {book.visibility}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(book)}
                    className="text-xs font-medium text-foreground-muted hover:text-foreground"
                  >
                    {t('admin.books.edit')}
                  </button>
                  <button
                    onClick={() => { setArchiveConfirmBook(book); }}
                    disabled={archivingBookId === book.id}
                    className="text-xs font-medium text-semantic-error hover:opacity-80 disabled:opacity-50"
                  >
                    {archivingBookId === book.id ? '...' : t('admin.books.archive')}
                  </button>
                  <button
                    onClick={() => handleViewGrants(book)}
                    className="text-sm font-medium text-accent hover:opacity-80"
                  >
                    {t('admin.books.manageAccess')} &rarr;
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
        {!isLoading && books.length === 0 && (
          <div className="col-span-full py-12 text-center text-foreground-muted">
            {t('admin.books.noBookResponses')}
          </div>
        )}
      </div>

      <BookCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => { setIsCreateModalOpen(false); resetCreateForm(); }}
        onSubmit={handleCreateBook}
        bookTitle={bookTitle}
        setBookTitle={setBookTitle}
        authorName={authorName}
        setAuthorName={setAuthorName}
        epubFile={epubFile}
        setEpubFile={setEpubFile}
        visibility={visibility}
        setVisibility={setVisibility}
        isSubmitting={isSubmitting}
        createError={createError}
        validationResult={validationResult}
      />

      {editingBook && (
        <BookEditModal
          isOpen={!!editingBook}
          onClose={() => setEditingBook(null)}
          onSubmit={handleUpdateBook}
          editTitle={editTitle}
          setEditTitle={setEditTitle}
          editAuthor={editAuthor}
          setEditAuthor={setEditAuthor}
          editDescription={editDescription}
          setEditDescription={setEditDescription}
          editVisibility={editVisibility}
          setEditVisibility={setEditVisibility}
          isEditSubmitting={isEditSubmitting}
          editError={editError}
        />
      )}

      <ConfirmDialog
        isOpen={archiveConfirmBook !== null}
        title={t('admin.books.confirmArchiveTitle')}
        description={t('admin.books.confirmArchive')}
        confirmLabel={t('admin.books.archive')}
        cancelLabel={t('annotation.cancel')}
        variant="danger"
        isLoading={archivingBookId !== null}
        onConfirm={() => { if (archiveConfirmBook) void handleArchiveBook(archiveConfirmBook.id); }}
        onCancel={() => { setArchiveConfirmBook(null); }}
      />
    </main>
  );
}
