import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { BookSelector, GrantForm, GrantList } from './components';
import type { Book, Grant, GrantFormData } from './components';
import { emptyFormData } from './components';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GrantsPage() {
  const navigate = useNavigate();
  const { bookId: routeBookId } = useParams<{ bookId: string }>();
  const { sessionToken, email, logout, capabilities } = useAuthStore();
  const { t } = useTranslation();

  // Data state
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>(routeBookId ?? '');
  const [grants, setGrants] = useState<Grant[]>([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState(true);
  const [isLoadingGrants, setIsLoadingGrants] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGrant, setEditingGrant] = useState<Grant | null>(null);
  const [formData, setFormData] = useState<GrantFormData>(emptyFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // -------------------------------------------------------------------------
  // Guard: redirect if unauthenticated or lacking permission
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!sessionToken) {
      navigate('/login');
      return;
    }
    if (!capabilities?.canManageAccess) {
      navigate('/admin/books');
    }
  }, [sessionToken, capabilities, navigate]);

  // -------------------------------------------------------------------------
  // Fetch books (for the selector)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!sessionToken) return;

    const controller = new AbortController();

    const fetchBooks = async () => {
      try {
        const data = await apiRequest<Book[]>('/api/books', {
          token: sessionToken,
          signal: controller.signal,
        });
        setBooks(data || []);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError((err as Error).message || t('admin.error.loadBooks'));
        }
      } finally {
        setIsLoadingBooks(false);
      }
    };

    void fetchBooks();
    return () => controller.abort();
  }, [sessionToken, t]);

  // -------------------------------------------------------------------------
  // Fetch grants for the selected book
  // -------------------------------------------------------------------------
  const fetchGrants = useCallback(
    async (bookId: string) => {
      if (!sessionToken) return;

      setIsLoadingGrants(true);
      setError(null);

      const controller = new AbortController();

      try {
        if (!bookId) {
          setGrants([]);
          setIsLoadingGrants(false);
          return;
        }
        const data = await apiRequest<Grant[]>(`/api/admin/books/${bookId}/grants`, {
          token: sessionToken,
          signal: controller.signal,
        });
        setGrants(data || []);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError((err as Error).message || t('grants.error.loadGrants'));
        }
      } finally {
        setIsLoadingGrants(false);
      }

      return () => controller.abort();
    },
    [sessionToken, t],
  );

  useEffect(() => {
    void fetchGrants(selectedBookId);
  }, [fetchGrants, selectedBookId]);

  // -------------------------------------------------------------------------
  // Navigation + modal handlers
  // -------------------------------------------------------------------------
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSelectBook = (bookId: string) => {
    setSelectedBookId(bookId);
    navigate(bookId ? `/admin/books/${bookId}/grants` : '/admin/grants');
  };

  const openCreateModal = () => {
    setFormData(emptyFormData());
    setFormErrors({});
    setShowCreateModal(true);
  };

  const openEditModal = (grant: Grant) => {
    setEditingGrant(grant);
    setFormErrors({});
    setFormData({
      email: grant.email,
      password: '',
      passwordConfirm: '',
      mode: grant.mode,
      commentsAllowed: grant.commentsAllowed,
      offlineAllowed: grant.offlineAllowed,
      expiresAt: grant.expiresAt ? new Date(grant.expiresAt).toISOString().split('T')[0] : '',
    });
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingGrant(null);
    setFormErrors({});
  };

  // -------------------------------------------------------------------------
  // Form validation
  // -------------------------------------------------------------------------
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.email) {
      errors.email = t('grants.form.error.emailRequired');
    }

    if (!editingGrant) {
      if (!formData.password) {
        errors.password = t('grants.form.error.passwordRequired');
      } else if (formData.password.length < 8) {
        errors.password = t('grants.form.error.passwordMinLength');
      } else if (formData.password !== formData.passwordConfirm) {
        errors.passwordConfirm = t('grants.form.error.passwordMismatch');
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // -------------------------------------------------------------------------
  // API mutations
  // -------------------------------------------------------------------------
  const handleSubmitCreate = async () => {
    if (!validateForm() || !selectedBookId) return;

    setIsSubmitting(true);
    try {
      await apiRequest<{ id: string }>(`/api/admin/books/${selectedBookId}/grants`, {
        method: 'POST',
        token: sessionToken!,
        body: JSON.stringify({
          bookId: selectedBookId,
          email: formData.email,
          password: formData.password,
          mode: formData.mode,
          commentsAllowed: formData.commentsAllowed,
          offlineAllowed: formData.offlineAllowed,
          expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : undefined,
        }),
      });
      setShowCreateModal(false);
      setFormData(emptyFormData());
      void fetchGrants(selectedBookId);
    } catch (err) {
      setFormErrors({ submit: (err as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitEdit = async () => {
    if (!validateForm() || !editingGrant) return;

    setIsSubmitting(true);
    try {
      await apiRequest<{ id: string }>(`/api/admin/grants/${editingGrant.id}`, {
        method: 'PATCH',
        token: sessionToken!,
        body: JSON.stringify({
          mode: formData.mode,
          commentsAllowed: formData.commentsAllowed,
          offlineAllowed: formData.offlineAllowed,
          expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
        }),
      });
      setEditingGrant(null);
      setFormData(emptyFormData());
      void fetchGrants(selectedBookId);
    } catch (err) {
      setFormErrors({ submit: (err as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (grant: Grant) => {
    try {
      await apiRequest<unknown>(`/api/admin/grants/${grant.id}/revoke`, {
        method: 'POST',
        token: sessionToken!,
      });
      void fetchGrants(selectedBookId);
    } catch (err) {
      setError((err as Error).message || t('grants.error.revoke'));
    }
  };

  const handleFormSubmit = () => {
    if (editingGrant) void handleSubmitEdit();
    else void handleSubmitCreate();
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('grants.title')}</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">{email}</span>
            <LocaleSwitcher />
            <button
              onClick={handleLogout}
              className="px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              {t('admin.userMenu.signOut')}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <BookSelector
          books={books}
          selectedBookId={selectedBookId}
          isLoadingBooks={isLoadingBooks}
          onSelectBook={handleSelectBook}
          onCreateGrant={openCreateModal}
        />

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <GrantList
          grants={grants}
          isLoadingGrants={isLoadingGrants}
          selectedBookId={selectedBookId}
          onEdit={openEditModal}
          onRevoke={(grant) => void handleRevoke(grant)}
        />
      </main>

      <GrantForm
        isOpen={showCreateModal || editingGrant !== null}
        editingGrant={editingGrant}
        formData={formData}
        formErrors={formErrors}
        isSubmitting={isSubmitting}
        onChange={setFormData}
        onSubmit={handleFormSubmit}
        onClose={closeModal}
      />
    </div>
  );
}
