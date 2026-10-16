import { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import type { BookResponse } from '@do-epub-studio/shared';
// EPUB validator (jszip) is lazy-loaded: only needed at book-upload time,
// keeps it out of the admin-route entry chunk (bundle budget ADR-107 §3).
import { ConfirmDialog } from '../../components/ui';
import { Spinner } from '@do-epub-studio/ui';
import { BookCreateModal, BookEditModal, BookRevisionModal, AdminBookCard } from './components';
import { useAdminStepUp } from './step-up';
import { BooksPageHeader } from './BooksPageHeader';
import { useAdminBookMutations } from './useAdminBookMutations';

export function AdminBookResponsesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const { execute: executeWithStepUp, modal: stepUpModal } = useAdminStepUp();
  const [books, setBookResponses] = useState<BookResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Auto-dismiss the success banner after 5s. */
  const scheduleSuccessClear = useCallback(() => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
    successTimerRef.current = setTimeout(() => {
      setSuccessMessage(null);
      successTimerRef.current = null;
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
        successTimerRef.current = null;
      }
    };
  }, []);

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
      const data = await apiRequest<BookResponse[]>('/api/admin/books', {
        token: sessionToken ?? undefined,
      });
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
  const {
    isCreateModalOpen,
    setIsCreateModalOpen,
    bookTitle,
    setBookTitle,
    authorName,
    setAuthorName,
    epubFile,
    setEpubFile,
    visibility,
    setVisibility,
    isSubmitting,
    createError,
    validationResult,
    handleCreateBook,
    resetCreateForm,
    revisionBook,
    setRevisionBook,
    revisionFile,
    setRevisionFile,
    isRevisionSubmitting,
    revisionError,
    setRevisionError,
    revisionValidation,
    setRevisionValidation,
    handleUploadRevision,
  } = useAdminBookMutations({
    sessionToken,
    executeWithStepUp,
    onSuccess: (msg) => {
      setSuccessMessage(msg);
      scheduleSuccessClear();
    },
    refreshBooks: fetchBookResponses,
    t,
  });

  const handleViewGrants = (book: BookResponse) => {
    void navigate(`/admin/books/${book.id}/grants`, { state: { bookTitle: book.title } });
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
      await executeWithStepUp(
        (tok) =>
          apiRequest(`/api/admin/books/${editingBook.id}`, {
            method: 'PATCH',
            token: tok ?? undefined,
            body: JSON.stringify({
              title: editTitle.trim(),
              authorName: editAuthor.trim() || null,
              description: editDescription.trim() || null,
              visibility: editVisibility,
            }),
          }),
        sessionToken ?? undefined,
      );
      setEditingBook(null);
      setSuccessMessage(t('admin.books.updateSuccess'));
      void fetchBookResponses();
      scheduleSuccessClear();
    } catch (err) {
      setEditError((err as Error).message);
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleArchiveBook = async (bookId: string) => {
    setArchivingBookId(bookId);
    try {
      await executeWithStepUp(
        (tok) =>
          apiRequest(`/api/admin/books/${bookId}`, {
            method: 'DELETE',
            token: tok ?? undefined,
          }),
        sessionToken ?? undefined,
      );
      setSuccessMessage(t('admin.books.archiveSuccess'));
      void fetchBookResponses();
      scheduleSuccessClear();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setArchivingBookId(null);
      setArchiveConfirmBook(null);
    }
  };

  return (
    <main id="main-content" className="min-dvh bg-background p-4 sm:p-6 lg:p-8">
      <BooksPageHeader onCreateClick={() => setIsCreateModalOpen(true)} />

      {error && (
        <div className="mb-6 p-4 bg-semantic-error/10 border border-semantic-error/30 rounded-sm text-semantic-error">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 bg-semantic-success/10 border border-semantic-success/30 rounded-sm text-semantic-success">
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
            <AdminBookCard
              key={book.id}
              book={book}
              onEdit={openEditModal}
              onUploadRevision={(b) => {
                setRevisionBook(b);
                setRevisionFile(null);
                setRevisionError(null);
                setRevisionValidation(null);
              }}
              onArchive={setArchiveConfirmBook}
              onManageAccess={handleViewGrants}
              isArchiving={archivingBookId === book.id}
              t={t}
            />
          ))
        )}
        {!isLoading && books.length === 0 && (
          <div className="paper-grain col-span-full rounded-sm border border-dashed border-border px-6 py-16 text-center text-foreground-muted">
            {t('admin.books.noBookResponses')}
          </div>
        )}
      </div>

      <BookCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          resetCreateForm();
        }}
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
      {revisionBook && (
        <BookRevisionModal
          isOpen={!!revisionBook}
          onClose={() => {
            setRevisionBook(null);
            setRevisionFile(null);
            setRevisionError(null);
          }}
          onSubmit={handleUploadRevision}
          bookTitle={revisionBook.title}
          epubFile={revisionFile}
          setEpubFile={setRevisionFile}
          isSubmitting={isRevisionSubmitting}
          error={revisionError}
          validationResult={revisionValidation}
        />
      )}

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
        onConfirm={() => {
          if (archiveConfirmBook) void handleArchiveBook(archiveConfirmBook.id);
        }}
        onCancel={() => {
          setArchiveConfirmBook(null);
        }}
      />

      {stepUpModal}
    </main>
  );
}
