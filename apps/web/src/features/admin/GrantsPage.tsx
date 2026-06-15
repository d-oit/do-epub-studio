import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import type { GrantResponse, BookResponse } from '@do-epub-studio/shared';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { PageContainer, Header } from '../../components/ui';
import {
  BookSelector,
  GrantForm,
  GrantList,
  emptyFormData,
} from './components';
import type { Book, Grant, GrantFormData } from './components';

interface LocationState {
  bookTitle?: string;
}

export function AdminGrantResponsesPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState | null;
  const sessionToken = useAuthStore((state) => state.sessionToken);

  // State
  const [grants, setGrants] = useState<GrantResponse[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingBooks, setIsLoadingBooks] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGrant, setEditingGrant] = useState<Grant | null>(null);
  const [formData, setFormData] = useState<GrantFormData>(emptyFormData());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchBooks = useCallback(async () => {
    setIsLoadingBooks(true);
    try {
      const data = await apiRequest<BookResponse[]>('/api/admin/books', {
        token: sessionToken ?? undefined,
      });
      setBooks(data.map(b => ({ id: b.id, title: b.title, slug: b.slug })));
    } catch (err) {
      console.error('Failed to fetch books:', err);
    } finally {
      setIsLoadingBooks(false);
    }
  }, [sessionToken]);

  const fetchGrants = useCallback(async () => {
    if (!bookId) {
      setGrants([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await apiRequest<GrantResponse[]>(`/api/admin/books/${bookId}/grants`, {
        token: sessionToken ?? undefined,
      });
      setGrants(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [bookId, sessionToken]);

  useEffect(() => {
    void fetchBooks();
  }, [fetchBooks]);

  useEffect(() => {
    void fetchGrants();
  }, [bookId, fetchGrants]);

  const handleSelectBook = (selectedId: string) => {
    if (selectedId) {
      void navigate(`/admin/books/${selectedId}/grants`);
    } else {
      void navigate('/admin/grants');
    }
  };

  const handleCreateGrant = () => {
    setEditingGrant(null);
    setFormData(emptyFormData());
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleEditGrant = (grant: Grant) => {
    setEditingGrant(grant);
    setFormData({
      email: grant.email,
      password: '',
      passwordConfirm: '',
      mode: grant.mode,
      commentsAllowed: grant.commentsAllowed,
      offlineAllowed: grant.offlineAllowed,
      expiresAt: grant.expiresAt ? grant.expiresAt.split('T')[0] : '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleFormSubmit = async () => {
    setFormErrors({});

    // Basic validation
    const errors: Record<string, string> = {};
    if (!formData.email) errors.email = t('grants.form.error.emailRequired');
    if (!editingGrant) {
      if (!formData.password) errors.password = t('grants.form.error.passwordRequired');
      else if (formData.password.length < 8) errors.password = t('grants.form.error.passwordMinLength');
      if (formData.password !== formData.passwordConfirm) {
        errors.passwordConfirm = t('grants.form.error.passwordMismatch');
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingGrant) {
        // Update existing grant
        await apiRequest(`/api/admin/grants/${editingGrant.id}`, {
          method: 'PATCH',
          token: sessionToken ?? undefined,
          body: JSON.stringify({
            mode: formData.mode,
            commentsAllowed: formData.commentsAllowed,
            offlineAllowed: formData.offlineAllowed,
            expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
          }),
        });
      } else {
        // Create new grant
        await apiRequest(`/api/admin/books/${bookId}/grants`, {
          method: 'POST',
          token: sessionToken ?? undefined,
          body: JSON.stringify({
            bookId,
            email: formData.email,
            password: formData.password,
            mode: formData.mode,
            commentsAllowed: formData.commentsAllowed,
            offlineAllowed: formData.offlineAllowed,
            expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
          }),
        });
      }
      setIsModalOpen(false);
      void fetchGrants();
    } catch (err) {
      setFormErrors({ submit: (err as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeGrant = async (grant: Grant) => {
    try {
      await apiRequest(`/api/admin/grants/${grant.id}/revoke`, {
        method: 'POST',
        token: sessionToken ?? undefined,
      });
      void fetchGrants();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const currentBookTitle = locationState?.bookTitle ?? (bookId ? books.find(b => b.id === bookId)?.title : undefined);

  return (
    <PageContainer>
      <Header
        title={t('admin.grants.title')}
        description={currentBookTitle ?? (bookId ? `${t('admin.books.title')} ID: ${bookId}` : t('admin.grants.selectBook'))}
        backHref="/admin/books"
        backLabel={t('admin.grants.backToBooks')}
        actions={
          <div className="flex items-center gap-4">
            <LocaleSwitcher />
          </div>
        }
      />

      <div className="mt-8">
        <BookSelector
          books={books}
          selectedBookId={bookId ?? ''}
          isLoadingBooks={isLoadingBooks}
          onSelectBook={handleSelectBook}
          onCreateGrant={handleCreateGrant}
        />

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <GrantList
          grants={grants}
          isLoadingGrants={isLoading}
          selectedBookId={bookId ?? ''}
          onEdit={handleEditGrant}
          onRevoke={handleRevokeGrant}
        />
      </div>

      <GrantForm
        isOpen={isModalOpen}
        editingGrant={editingGrant}
        formData={formData}
        formErrors={formErrors}
        isSubmitting={isSubmitting}
        onChange={setFormData}
        onSubmit={handleFormSubmit}
        onClose={() => setIsModalOpen(false)}
      />
    </PageContainer>
  );
}
