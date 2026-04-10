import { type ChangeEvent, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Button, Input, Modal } from '@do-epub-studio/ui';

import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Book {
  id: string;
  slug: string;
  title: string;
}

interface Grant {
  id: string;
  email: string;
  mode: string;
  commentsAllowed: boolean;
  offlineAllowed: boolean;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

interface GrantFormData {
  email: string;
  password: string;
  passwordConfirm: string;
  mode: string;
  commentsAllowed: boolean;
  offlineAllowed: boolean;
  expiresAt: string;
}

const DEFAULT_EXPIRY_DAYS = 30;

function defaultExpiryDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + DEFAULT_EXPIRY_DAYS);
  return d.toISOString().split('T')[0];
}

function emptyFormData(): GrantFormData {
  return {
    email: '',
    password: '',
    passwordConfirm: '',
    mode: 'private',
    commentsAllowed: false,
    offlineAllowed: false,
    expiresAt: defaultExpiryDate(),
  };
}

const GRANT_MODES = [
  { value: 'private', label: 'Private' },
  { value: 'password_protected', label: 'Password Protected' },
  { value: 'reader_only', label: 'Reader Only' },
  { value: 'editorial_review', label: 'Editorial Review' },
  { value: 'public', label: 'Public' },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GrantsPage() {
  const navigate = useNavigate();
  const { bookId: routeBookId } = useParams<{ bookId: string }>();
  const { sessionToken, email, logout, capabilities } = useAuthStore();
  const { t } = useTranslation();

  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>(routeBookId ?? '');
  const [grants, setGrants] = useState<Grant[]>([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState(true);
  const [isLoadingGrants, setIsLoadingGrants] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGrant, setEditingGrant] = useState<Grant | null>(null);
  const [revokingGrant, setRevokingGrant] = useState<Grant | null>(null);

  // Form state
  const [formData, setFormData] = useState<GrantFormData>(emptyFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // -----------------------------------------------------------------------
  // Redirect if user cannot manage access
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!sessionToken) {
      navigate('/login');
      return;
    }
    if (!capabilities?.canManageAccess) {
      navigate('/admin/books');
      return;
    }
  }, [sessionToken, capabilities, navigate]);

  // -----------------------------------------------------------------------
  // Fetch books (for selector)
  // -----------------------------------------------------------------------
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

  // -----------------------------------------------------------------------
  // Fetch grants
  // -----------------------------------------------------------------------
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
        const data = await apiRequest<Grant[]>(
          `/api/admin/books/${bookId}/grants`,
          {
            token: sessionToken,
            signal: controller.signal,
          },
        );
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

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSelectBook = (bookId: string) => {
    setSelectedBookId(bookId);
    if (bookId) {
      navigate(`/admin/books/${bookId}/grants`);
    } else {
      navigate('/admin/grants');
    }
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
      expiresAt: grant.expiresAt
        ? new Date(grant.expiresAt).toISOString().split('T')[0]
        : '',
    });
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingGrant(null);
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.email) {
      errors.email = t('grants.form.error.emailRequired');
    }

    // Password is required for new grants
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

  const handleSubmitCreate = async () => {
    if (!validateForm() || !selectedBookId) return;

    setIsSubmitting(true);
    try {
      const payload = {
        bookId: selectedBookId,
        email: formData.email,
        password: formData.password,
        mode: formData.mode,
        commentsAllowed: formData.commentsAllowed,
        offlineAllowed: formData.offlineAllowed,
        expiresAt: formData.expiresAt
          ? new Date(formData.expiresAt).toISOString()
          : undefined,
      };

      await apiRequest<{ id: string }>(
        `/api/admin/books/${selectedBookId}/grants`,
        {
          method: 'POST',
          token: sessionToken!,
          body: JSON.stringify(payload),
        },
      );

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
      const payload: Record<string, unknown> = {
        mode: formData.mode,
        commentsAllowed: formData.commentsAllowed,
        offlineAllowed: formData.offlineAllowed,
        expiresAt: formData.expiresAt
          ? new Date(formData.expiresAt).toISOString()
          : null,
      };

      await apiRequest<{ id: string }>(
        `/api/admin/grants/${editingGrant.id}`,
        {
          method: 'PATCH',
          token: sessionToken!,
          body: JSON.stringify(payload),
        },
      );

      setEditingGrant(null);
      setFormData(emptyFormData());
      void fetchGrants(selectedBookId);
    } catch (err) {
      setFormErrors({ submit: (err as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokingGrant) return;

    try {
      await apiRequest<unknown>(
        `/api/admin/grants/${revokingGrant.id}/revoke`,
        {
          method: 'POST',
          token: sessionToken!,
        },
      );

      setRevokingGrant(null);
      void fetchGrants(selectedBookId);
    } catch (err) {
      setError((err as Error).message || t('grants.error.revoke'));
      setRevokingGrant(null);
    }
  };

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  const modeLabel = (mode: string): string => {
    const found = GRANT_MODES.find((m) => m.value === mode);
    return found ? found.label : mode;
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return t('grants.never');
    return new Date(dateStr).toLocaleDateString();
  };

  const isExpired = (grant: Grant): boolean => {
    if (grant.revokedAt) return true;
    if (grant.expiresAt) return new Date(grant.expiresAt) < new Date();
    return false;
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('grants.title')}
          </h1>
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
        {/* Book selector + create button */}
        <div className="mb-6 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center space-x-3">
            <label
              htmlFor="book-selector"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {t('grants.selectBook')}
            </label>
            <select
              id="book-selector"
              value={selectedBookId}
              onChange={(e) => handleSelectBook(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoadingBooks}
            >
              <option value="">{t('grants.allBooks')}</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title}
                </option>
              ))}
            </select>
          </div>

          {selectedBookId && (
            <Button onClick={openCreateModal} size="sm">
              {t('grants.createGrant')}
            </Button>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* No book selected */}
        {!selectedBookId && !isLoadingGrants && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              {t('grants.selectBookPrompt')}
            </p>
          </div>
        )}

        {/* Loading spinner */}
        {isLoadingGrants && selectedBookId && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        )}

        {/* Grants table */}
        {selectedBookId && !isLoadingGrants && grants.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              {t('grants.noGrants')}
            </p>
          </div>
        )}

        {selectedBookId && !isLoadingGrants && grants.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('grants.table.email')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('grants.table.mode')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('grants.table.capabilities')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('grants.table.status')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('grants.table.expiry')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('grants.table.created')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('grants.table.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {grants.map((grant) => (
                    <tr
                      key={grant.id}
                      className={
                        isExpired(grant)
                          ? 'bg-red-50 dark:bg-red-900/10'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                      }
                    >
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {grant.email}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                          {modeLabel(grant.mode)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-wrap gap-1">
                          {grant.commentsAllowed && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300">
                              {t('grants.capabilities.comments')}
                            </span>
                          )}
                          {grant.offlineAllowed && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300">
                              {t('grants.capabilities.offline')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {grant.revokedAt ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300">
                            {t('grants.status.revoked')}
                          </span>
                        ) : isExpired(grant) ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300">
                            {t('grants.status.expired')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300">
                            {t('grants.status.active')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(grant.expiresAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(grant.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <div className="flex justify-end space-x-2">
                          {!grant.revokedAt && (
                            <>
                              <button
                                onClick={() => openEditModal(grant)}
                                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                              >
                                {t('grants.actions.edit')}
                              </button>
                              <button
                                onClick={() => setRevokingGrant(grant)}
                                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              >
                                {t('grants.actions.revoke')}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* Create / Edit Grant Modal                                            */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        isOpen={showCreateModal || editingGrant !== null}
        onClose={closeModal}
        title={
          editingGrant
            ? t('grants.editGrantTitle')
            : t('grants.createGrantTitle')
        }
        footer={
          <div className="flex justify-end space-x-3">
            <Button variant="secondary" onClick={closeModal} disabled={isSubmitting}>
              {t('annotation.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (editingGrant) void handleSubmitEdit();
                else void handleSubmitCreate();
              }}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? t('grants.form.submitting')
                : editingGrant
                  ? t('grants.actions.save')
                  : t('grants.createGrant')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Email (read-only in edit mode) */}
          <Input
            label={t('grants.form.email')}
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            error={formErrors.email}
            disabled={editingGrant !== null}
            required
          />

          {/* Password fields (create only) */}
          {!editingGrant && (
            <>
              <Input
                label={t('grants.form.password')}
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                error={formErrors.password}
                required
              />
              <Input
                label={t('grants.form.passwordConfirm')}
                type="password"
                value={formData.passwordConfirm}
                onChange={(e) =>
                  setFormData({ ...formData, passwordConfirm: e.target.value })
                }
                error={formErrors.passwordConfirm}
                required
              />
            </>
          )}

          {/* Grant mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('grants.form.mode')}
            </label>
            <select
              value={formData.mode}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setFormData({ ...formData, mode: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {GRANT_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </div>

          {/* Capability toggles */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.commentsAllowed}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setFormData({
                    ...formData,
                    commentsAllowed: e.target.checked,
                  })
                }
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {t('grants.capabilities.comments')}
              </span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.offlineAllowed}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setFormData({
                    ...formData,
                    offlineAllowed: e.target.checked,
                  })
                }
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {t('grants.capabilities.offline')}
              </span>
            </label>
          </div>

          {/* Expiry date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('grants.form.expiry')}
            </label>
            <input
              type="date"
              value={formData.expiresAt}
              onChange={(e) =>
                setFormData({ ...formData, expiresAt: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('grants.form.expiryHint')}
            </p>
          </div>

          {/* Submit error */}
          {formErrors.submit && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">
              {formErrors.submit}
            </div>
          )}
        </div>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Revoke Confirmation Modal                                            */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        isOpen={revokingGrant !== null}
        onClose={() => setRevokingGrant(null)}
        title={t('grants.revokeTitle')}
        footer={
          <div className="flex justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={() => setRevokingGrant(null)}
            >
              {t('annotation.cancel')}
            </Button>
            <Button variant="danger" onClick={() => void handleRevoke()}>
              {t('grants.actions.revoke')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {t('grants.revokeMessage').replace('{email}', revokingGrant?.email ?? '')}
        </p>
      </Modal>
    </div>
  );
}
